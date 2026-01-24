package utils

import (
	"archive/tar"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"

	"net"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/compose-spec/compose-go/v2/loader"
	"github.com/compose-spec/compose-go/v2/types"
	"github.com/docker/cli/cli/command"
	"github.com/docker/cli/cli/flags"
	"github.com/docker/compose/v2/pkg/api"
	"github.com/docker/compose/v2/pkg/compose"
	"github.com/docker/docker/api/types/build"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/go-connections/nat"
	"github.com/pwnthemall/pwnthemall/backend/config"
	"github.com/pwnthemall/pwnthemall/backend/debug"
	"github.com/pwnthemall/pwnthemall/backend/models"
)

func EnsureDockerClientConnected() error {
	if config.DockerClient == nil {
		if err := config.ConnectDocker(); err != nil {
			return err
		}
	} else if _, err := config.DockerClient.Info(context.Background()); err != nil {
		if err := config.ConnectDocker(); err != nil {
			return err
		}
	}
	return nil
}

func TarDirectory(dirPath string) (io.Reader, error) {
	buf := new(bytes.Buffer)
	tw := tar.NewWriter(buf)
	defer tw.Close()

	err := filepath.Walk(dirPath, func(file string, fi os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if fi.IsDir() {
			return nil
		}

		relPath, err := filepath.Rel(dirPath, file)
		if err != nil {
			return err
		}

		hdr, err := tar.FileInfoHeader(fi, "")
		if err != nil {
			return err
		}
		hdr.Name = relPath

		if err := tw.WriteHeader(hdr); err != nil {
			return err
		}

		data, err := os.ReadFile(file)
		if err != nil {
			return err
		}
		_, err = tw.Write(data)
		return err
	})

	if err != nil {
		return nil, err
	}
	return buf, nil
}

func FindAvailablePorts(count int) ([]int, error) {
	ports := []int{}

	for len(ports) < count {
		l, err := net.Listen("tcp", ":0")
		if err != nil {
			return nil, fmt.Errorf("impossible de trouver un port libre: %v", err)
		}

		port := l.Addr().(*net.TCPAddr).Port
		ports = append(ports, port)
		l.Close()
	}

	return ports, nil
}

func BuildDockerImage(slug string, sourceDir string) (string, error) {
	if err := EnsureDockerClientConnected(); err != nil {
		return "", err
	}
	tarReader, err := TarDirectory(sourceDir)
	if err != nil {
		return "", err
	}
	ctx := context.Background()
	prefix, err := getDockerImagePrefix()
	if err != nil {
		return "", fmt.Errorf("could not get Docker image prefix: %w", err)
	}
	imageName := prefix + slug
	buildOptions := build.ImageBuildOptions{
		Tags:           []string{imageName},
		Dockerfile:     "Dockerfile",
		Remove:         true,
		SuppressOutput: true,
	}
	buildResponse, err := config.DockerClient.ImageBuild(ctx, tarReader, buildOptions)
	if err != nil {
		return imageName, err
	}
	defer buildResponse.Body.Close()
	if err := streamAndDetectBuildError(buildResponse.Body); err != nil {
		debug.Log("Docker build failed: %v", err)
		return imageName, err
	}
	io.Copy(os.Stdout, buildResponse.Body)
	debug.Log("Built image %s for challenge %s", imageName, slug)
	return imageName, nil
}

func IsImageBuilt(slug string) (string, bool) {
	if err := EnsureDockerClientConnected(); err != nil {
		debug.Log("Docker client not connected: %v", err)
		return "", false
	}

	ctx := context.Background()

	prefix, err := getDockerImagePrefix()
	if err != nil {
		debug.Log("Could not get Docker image prefix: %v", err)
		return "", false
	}

	imageName := prefix + slug

	filtersArgs := filters.NewArgs()
	filtersArgs.Add("reference", imageName)

	images, err := config.DockerClient.ImageList(ctx, image.ListOptions{
		Filters: filtersArgs,
	})
	if err != nil {
		debug.Log("Failed to list docker images: %v", err)
		return "", false
	}

	if len(images) > 0 {
		return imageName, true
	}
	return imageName, false
}

func StartDockerInstance(image string, teamId int, userId int, internalPorts []int, hostPorts []int) (string, error) {
	if len(internalPorts) != len(hostPorts) {
		return "", fmt.Errorf("internal and host ports length mismatch")
	}

	if err := EnsureDockerClientConnected(); err != nil {
		return "", fmt.Errorf("docker client not connected: %w", err)
	}

	ctx := context.Background()

	// Use challenge name as base, add unique suffix if needed
	baseContainerName := image
	containerName := baseContainerName

	// Check if container with this name already exists
	existing, err := config.DockerClient.ContainerList(ctx, container.ListOptions{
		All: true,
	})

	if err != nil {
		return "", fmt.Errorf("failed to list containers: %w", err)
	}

	// If container exists, add a unique suffix
	containerExists := false
	for _, c := range existing {
		for _, name := range c.Names {
			if name == "/"+containerName {
				containerExists = true
				break
			}
		}
		if containerExists {
			break
		}
	}

	if containerExists {
		// Add a unique suffix based on team and user
		containerName = fmt.Sprintf("%s_%d_%d", baseContainerName, teamId, userId)
	}

	var dockerCfg models.DockerConfig
	if err := config.DB.First(&dockerCfg).Error; err != nil {
		return "", fmt.Errorf("failed to load docker config from DB: %w", err)
	}

	portBindings := nat.PortMap{}
	exposedPorts := nat.PortSet{}

	for i, internal := range internalPorts {
		containerPort := nat.Port(fmt.Sprintf("%d/tcp", internal))
		hostPort := hostPorts[i]

		exposedPorts[containerPort] = struct{}{}
		portBindings[containerPort] = []nat.PortBinding{
			{HostIP: "0.0.0.0", HostPort: fmt.Sprint(hostPort)},
		}
	}

	hostConfig := &container.HostConfig{
		Runtime: config.DockerRuntime,
		Resources: container.Resources{
			Memory:   int64(dockerCfg.MaxMemByInstance) * 1024 * 1024,
			NanoCPUs: int64(dockerCfg.MaxCpuByInstance) * 1_000_000_000,
		},
		PortBindings: portBindings,
		AutoRemove:   true,
		RestartPolicy: container.RestartPolicy{
			Name: "no",
		},
	}

	debug.Log("Creating Docker network for team %d", teamId)
	networkName, err := EnsureTeamNetworkExists(teamId)
	if err != nil {
		return fmt.Sprintf("failed to ensure team %d", teamId), err
	}
	debug.Log("Docker network created: %s", networkName)

	containerTimeout := 60
	networkingConfig := &network.NetworkingConfig{
		EndpointsConfig: map[string]*network.EndpointSettings{
			networkName: {},
		},
	}

	resp, err := config.DockerClient.ContainerCreate(
		ctx,
		&container.Config{
			Image:        image,
			Tty:          false,
			ExposedPorts: exposedPorts,
			StopTimeout:  &containerTimeout,
		},
		hostConfig,
		networkingConfig,
		nil,
		containerName,
	)
	if err != nil {
		return "", fmt.Errorf("failed to create container: %w", err)
	}

	if err := config.DockerClient.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		return "", fmt.Errorf("failed to start container: %w", err)
	}

	debug.Log(
		"Started container %s for team %d user %d on host ports %v mapping to internal %v",
		containerName, teamId, userId, hostPorts, internalPorts,
	)
	return containerName, nil
}

func StopDockerInstance(containerName string) error {
	debug.Log("Attempting to stop Docker container: %s", containerName)

	if err := EnsureDockerClientConnected(); err != nil {
		debug.Log("Docker client connection failed: %v", err)
		return fmt.Errorf("docker client not connected: %w", err)
	}

	ctx := context.Background()

	if containerName == "" {
		debug.Println("containerName invalid, nothing to stop")
		return nil
	}

	debug.Log("Removing container %s with force", containerName)
	if err := config.DockerClient.ContainerRemove(ctx, containerName, container.RemoveOptions{Force: true}); err != nil {
		debug.Log("Failed to remove container %s: %v", containerName, err)
		return fmt.Errorf("failed to remove container %s: %w", containerName, err)
	}

	debug.Log("Successfully stopped and removed container %s", containerName)
	return nil
}

func EnsureTeamNetworkExists(teamId int) (string, error) {
	ctx := context.Background()
	networkName := fmt.Sprintf("team_%d_network", teamId)

	networks, err := config.DockerClient.NetworkList(ctx, network.ListOptions{
		Filters: filters.NewArgs(filters.Arg("name", networkName)),
	})
	if err != nil {
		debug.Log(err.Error())
		return "", fmt.Errorf("docker_network_unavailable")
	}

	if len(networks) > 0 {
		return networkName, nil
	}

	subnet, gateway, err := GetTeamSubnet(teamId)
	if err != nil {
		debug.Log(err.Error())
		return "", fmt.Errorf("docker_network_unavailable")
	}

	debug.Log("Team %d | subnet: %s | gateway: %s", teamId, subnet, gateway)

	ipamConfig := &network.IPAMConfig{
		Subnet:  subnet,  // exemple: "172.18.0.0/24"
		Gateway: gateway, // exemple: "172.18.0.1"
	}
	ipam := &network.IPAM{
		Driver: "default",
		Config: []network.IPAMConfig{*ipamConfig},
	}

	_, err = config.DockerClient.NetworkCreate(
		ctx,
		networkName,
		network.CreateOptions{
			Driver:     "bridge",
			Attachable: true,
			IPAM:       ipam,
			// Internal: true, // using iptables instead
		},
	)
	if err != nil {
		debug.Log(err.Error())
		return "", fmt.Errorf("docker_network_unavailable")
	}
	return networkName, nil
}

func GetComposeFile(slug string) (string, error) {
	debug.Log("GetComposeFile with slug: %s", slug)
	_, content, err := prepareChallengeContext(slug)
	if err != nil {
		return "", err
	}
	return content, nil
}

func RandomizeServicePorts(project *types.Project) ([]int, error) {
	ports := []int{}

	for i, service := range project.Services {
		for j, portConfig := range service.Ports {
			if portConfig.Published == "" {
				l, err := net.Listen("tcp", ":0")
				if err != nil {
					return nil, fmt.Errorf("failed to find free port: %v", err)
				}
				freePort := l.Addr().(*net.TCPAddr).Port
				l.Close()

				project.Services[i].Ports[j].Published = strconv.Itoa(freePort)
				ports = append(ports, freePort)
			}
		}
	}

	return ports, nil
}

func CreateComposeProject(slug string, teamId int, userId int, composeFile string) (*types.Project, error) {
	ctx := context.TODO()
	tmpDir, _, err := prepareChallengeContext(slug)
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(tmpDir)

	configDetails := types.ConfigDetails{
		WorkingDir: tmpDir,
		ConfigFiles: []types.ConfigFile{
			{Filename: "docker-compose.yml", Content: []byte(composeFile)},
		},
		Environment: nil,
	}
	projectName := fmt.Sprintf("%s_%d_%d", slug, teamId, userId)
	p, err := loader.LoadWithContext(ctx, configDetails, func(options *loader.Options) {
		options.SetProjectName(projectName, true)
	})
	if err != nil {
		return nil, fmt.Errorf("failed to load compose file: %w", err)
	}

	for svcName, svc := range p.Services {
		svc.Runtime = config.DockerRuntime
		if svc.Build != nil {
			sourceDir := tmpDir
			if svc.Build.Context != "" {
				sourceDir = filepath.Join(tmpDir, svc.Build.Context)
				if _, err := os.Stat(sourceDir); os.IsNotExist(err) {
					sourceDir = tmpDir
				}
			}

			imageName, err := BuildDockerImage(fmt.Sprintf("%s-%s", slug, svcName), sourceDir)
			if err != nil {
				return nil, fmt.Errorf("failed to build image for %s: %w", svcName, err)
			}
			svc.Image = imageName
			svc.Build = nil
			p.Services[svcName] = svc
			debug.Log("Built image %s for service %s", imageName, svcName)
		}
	}

	debug.Log("Creating Docker network for team %d", teamId)
	networkName, err := EnsureTeamNetworkExists(teamId)
	if err != nil {
		return nil, fmt.Errorf("failed to ensure team network: %w", err)
	}
	debug.Log("Docker network created: %s", networkName)
	p.Networks = map[string]types.NetworkConfig{
		networkName: {
			Name:     networkName,
			Driver:   "bridge",
			External: true,
		},
	}

	for svcName, svc := range p.Services {
		svc.Networks = map[string]*types.ServiceNetworkConfig{
			networkName: {Aliases: []string{svcName}},
		}
		p.Services[svcName] = svc
	}

	addServiceLabels(p)
	return p, nil
}

func StartComposeInstance(project *types.Project, teamId int) error {
	ctx := context.TODO()

	networkName, err := EnsureTeamNetworkExists(teamId)
	if err != nil {
		return fmt.Errorf("failed to ensure team network: %w", err)
	}
	debug.Log("StartComposeInstance started for team %d on network %s", teamId, networkName)

	dockerCli, err := command.NewDockerCli(
		command.WithStandardStreams(),
		command.WithAPIClient(config.DockerClient),
	)
	if err != nil {
		return err
	}
	debug.Log("dockerCli created")
	if err := dockerCli.Initialize(flags.NewClientOptions()); err != nil {
		return err
	}
	debug.Log("serverInfo: %s", dockerCli.ServerInfo().OSType)
	srv := compose.NewComposeService(dockerCli)
	for _, service := range project.Services {
		if service.Networks == nil {
			service.Networks = map[string]*types.ServiceNetworkConfig{}
		}
		service.Networks[networkName] = &types.ServiceNetworkConfig{}
	}

	// debug.Log("Building compose project: %s", project.Name)
	// if err := srv.Build(ctx, project, api.BuildOptions{Deps: true}); err != nil {
	// 	return fmt.Errorf("error building compose project: %w", err)
	// }

	createOptions := api.CreateOptions{
		// Build: &api.BuildOptions{
		// 	NoCache: true,
		// 	Deps:    true,
		// },
		RemoveOrphans: true,
	}
	err = srv.Up(ctx, project, api.UpOptions{Create: createOptions, Start: api.StartOptions{}})
	if err != nil {
		return fmt.Errorf("error starting compose project: %w", err)
	}
	return nil
}

func StopComposeInstance(projectName string) error {
	ctx := context.Background()
	dockerCli, err := command.NewDockerCli(
		command.WithStandardStreams(),
		command.WithAPIClient(config.DockerClient),
	)
	if err != nil {
		return err
	}
	debug.Log("dockerCli created")

	if err := dockerCli.Initialize(flags.NewClientOptions()); err != nil {
		return err
	}
	debug.Log("serverInfo: %s", dockerCli.ServerInfo().OSType)
	srv := compose.NewComposeService(dockerCli)
	options := api.DownOptions{
		RemoveOrphans: true,
		Volumes:       true,
	}
	err = srv.Down(ctx, projectName, options)
	if err != nil {
		return fmt.Errorf("error stopping compose project: %w", err)
	}
	return nil
}

func getDockerImagePrefix() (string, error) {
	var cfg models.DockerConfig
	result := config.DB.First(&cfg)
	if result.Error != nil {
		return "", fmt.Errorf("could not load DockerConfig: %w", result.Error)
	}

	if cfg.ImagePrefix == "" {
		return "pta-", nil
	}
	return cfg.ImagePrefix, nil
}

func streamAndDetectBuildError(r io.Reader) error {
	type buildLine struct {
		Stream      string `json:"stream"`
		Error       string `json:"error"`
		ErrorDetail struct {
			Message string `json:"message"`
		} `json:"errorDetail"`
	}

	decoder := json.NewDecoder(r)
	for decoder.More() {
		var msg buildLine
		if err := decoder.Decode(&msg); err != nil {
			return fmt.Errorf("failed to parse docker build output: %w", err)
		}

		if msg.Error != "" {
			return fmt.Errorf("docker build failed: %s", msg.ErrorDetail.Message)
		}

		if msg.Stream != "" {
			fmt.Print(msg.Stream)
		}
	}
	return nil
}

func addServiceLabels(project *types.Project) {
	z := 0
	for i, s := range project.Services {
		s.CustomLabels = map[string]string{
			api.ProjectLabel:     project.Name,
			api.ServiceLabel:     strconv.Itoa(z),
			api.VersionLabel:     api.ComposeVersion,
			api.WorkingDirLabel:  "/",
			api.ConfigFilesLabel: strings.Join(project.ComposeFiles, ","),
			api.OneoffLabel:      "False", // default, will be overridden by `run` command
		}
		z++
		project.Services[i] = s
	}
}

func prepareChallengeContext(slug string) (string, string, error) {
	tmpDir, err := os.MkdirTemp("", "compose-"+slug)
	if err != nil {
		return "", "", fmt.Errorf("failed to create temp dir: %w", err)
	}
	if err := DownloadChallengeContext(slug, tmpDir); err != nil {
		os.RemoveAll(tmpDir)
		return "", "", fmt.Errorf("failed to download challenge context: %w", err)
	}
	// Debug: List the contents of tmpDir
	entries, _ := os.ReadDir(tmpDir)
	debug.Log("Contents of %s:", tmpDir)
	for _, e := range entries {
		debug.Log("  %s (isDir: %v)", e.Name(), e.IsDir())
	}
	composePath := filepath.Join(tmpDir, "docker-compose.yml")
	content, err := os.ReadFile(composePath)
	if err != nil {
		os.RemoveAll(tmpDir)
		return "", "", fmt.Errorf("failed to read docker-compose.yml: %w", err)
	}
	return tmpDir, string(content), nil
}
