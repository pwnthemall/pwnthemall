package controllers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/compose-spec/compose-go/v2/types"
	"github.com/gin-gonic/gin"
	"github.com/lib/pq"
	"github.com/pwnthemall/pwnthemall/backend/config"
	"github.com/pwnthemall/pwnthemall/backend/debug"
	"github.com/pwnthemall/pwnthemall/backend/models"
	"github.com/pwnthemall/pwnthemall/backend/utils"
	"gorm.io/gorm"
)

const (
	errChallengeNotFoundLog = "Challenge not found with ID %s: %v"
	errDockerUnavailable    = "docker_unavailable"
	msgDockerUnavailable    = "Docker service is currently unavailable. Please try again later or contact an administrator."
)

// ensureImageBuiltOrBuild checks if Docker image exists, builds if necessary
func ensureImageBuiltOrBuild(challenge models.Challenge) (string, error) {
	imageName, exists := utils.IsImageBuilt(challenge.Slug)
	if exists {
		return imageName, nil
	}

	// Check Docker connection
	if err := utils.EnsureDockerClientConnected(); err != nil {
		debug.Log("Docker connection failed for challenge %s: %v", challenge.Slug, err)
		return "", fmt.Errorf(errDockerUnavailable)
	}

	// Download challenge context
	tmpDir := filepath.Join(os.TempDir(), challenge.Slug)
	if err := utils.DownloadChallengeContext(challenge.Slug, tmpDir); err != nil {
		debug.Log("Failed to download challenge context: %v", err)
		os.RemoveAll(tmpDir)
		return "", fmt.Errorf("failed_to_download_challenge")
	}
	defer os.RemoveAll(tmpDir)

	// Build image
	imageName, err := utils.BuildDockerImage(challenge.Slug, tmpDir)
	if err != nil {
		debug.Log("Docker build failed for challenge %s: %v", challenge.Slug, err)
		return "", fmt.Errorf("docker_build_failed")
	}

	debug.Log("Image built successfully: %s", imageName)
	return imageName, nil
}

// checkInstanceCooldown checks if cooldown period has elapsed
func checkInstanceCooldown(teamID uint, challengeID uint, dockerConfig models.DockerConfig) (bool, int) {
	if dockerConfig.InstanceCooldownSeconds <= 0 {
		return true, 0
	}

	var cd models.InstanceCooldown
	if err := config.DB.Where(queryTeamAndChallengeID, teamID, challengeID).First(&cd).Error; err != nil {
		return true, 0
	}

	elapsed := time.Since(cd.LastStoppedAt)
	remaining := time.Duration(dockerConfig.InstanceCooldownSeconds)*time.Second - elapsed
	if remaining > 0 {
		return false, int(remaining.Seconds())
	}

	return true, 0
}

// checkInstanceLimits verifies user/team instance limits
func checkInstanceLimits(user models.User, dockerConfig models.DockerConfig) error {
	// Check if instance already exists for this team+challenge
	var countExist int64
	config.DB.Model(&models.Instance{}).
		Where(queryTeamAndChallengeID, user.Team.ID, 0).
		Count(&countExist)

	// Check user instance limit
	var countUser int64
	config.DB.Model(&models.Instance{}).
		Where("user_id = ?", user.ID).
		Count(&countUser)
	if int(countUser) >= dockerConfig.InstancesByUser {
		return fmt.Errorf("max_instances_by_user_reached")
	}

	// Check team instance limit
	var countTeam int64
	config.DB.Model(&models.Instance{}).
		Where("team_id = ?", user.Team.ID).
		Count(&countTeam)
	if int(countTeam) >= dockerConfig.InstancesByTeam {
		return fmt.Errorf("max_instances_by_team_reached")
	}

	return nil
}

// allocatePortsForChallenge finds available ports for challenge
func allocatePortsForChallenge(challenge models.Challenge) ([]int, []int, error) {
	portCount := len(challenge.Ports)
	if portCount == 0 {
		return nil, nil, fmt.Errorf("no_ports_defined_for_challenge")
	}

	ports, err := utils.FindAvailablePorts(portCount)
	if err != nil {
		return nil, nil, fmt.Errorf("no_free_ports")
	}

	internalPorts := make([]int, len(challenge.Ports))
	for i, p := range challenge.Ports {
		internalPorts[i] = int(p)
	}

	return ports, internalPorts, nil
}

// calculateInstanceExpiration determines when instance should expire
func calculateInstanceExpiration(dockerConfig models.DockerConfig) time.Time {
	if dockerConfig.InstanceTimeout > 0 {
		return time.Now().Add(time.Duration(dockerConfig.InstanceTimeout) * time.Minute)
	}
	return time.Now().Add(24 * time.Hour)
}

// createInstanceRecord creates database record for new instance
func createInstanceRecord(containerName string, user models.User, challenge models.Challenge, ports []int, expiresAt time.Time) (*models.Instance, error) {
	ports64 := make(pq.Int64Array, len(ports))
	for i, p := range ports {
		ports64[i] = int64(p)
	}

	instance := models.Instance{
		Container:   containerName,
		UserID:      user.ID,
		TeamID:      *user.TeamID,
		ChallengeID: challenge.ID,
		Ports:       ports64,
		CreatedAt:   time.Now(),
		ExpiresAt:   expiresAt,
		Status:      "running",
	}

	if err := config.DB.Create(&instance).Error; err != nil {
		return nil, err
	}

	return &instance, nil
}

// formatConnectionInfo formats connection strings with IP and ports
func formatConnectionInfo(challenge models.Challenge, ports []int) []string {
	if len(challenge.ConnectionInfo) == 0 {
		return nil
	}

	ip := os.Getenv("PTA_DOCKER_WORKER_IP")
	if ip == "" {
		ip = "worker-ip"
	}

	connectionInfo := make([]string, 0, len(challenge.ConnectionInfo))
	for i, info := range challenge.ConnectionInfo {
		formattedInfo := strings.ReplaceAll(info, "$ip", ip)
		if i < len(ports) {
			for j, originalPort := range challenge.Ports {
				if j < len(ports) {
					originalPortStr := fmt.Sprintf(":%d", originalPort)
					newPortStr := fmt.Sprintf(":%d", ports[j])
					formattedInfo = strings.ReplaceAll(formattedInfo, originalPortStr, newPortStr)
				}
			}
		}
		connectionInfo = append(connectionInfo, formattedInfo)
	}

	return connectionInfo
}

// broadcastInstanceStart sends WebSocket notification for instance start
func broadcastInstanceStart(instance *models.Instance, user models.User, challenge models.Challenge, ports []int) {
	if utils.WebSocketHub == nil {
		return
	}

	connectionInfo := formatConnectionInfo(challenge, ports)

	type InstanceEvent struct {
		Event          string    `json:"event"`
		TeamID         uint      `json:"teamId"`
		UserID         uint      `json:"userId"`
		Username       string    `json:"username"`
		ChallengeID    uint      `json:"challengeId"`
		Status         string    `json:"status"`
		CreatedAt      time.Time `json:"createdAt"`
		ExpiresAt      time.Time `json:"expiresAt"`
		Container      string    `json:"container"`
		Ports          []int     `json:"ports"`
		ConnectionInfo []string  `json:"connectionInfo"`
	}

	event := InstanceEvent{
		Event:          "instance_update",
		TeamID:         user.Team.ID,
		UserID:         user.ID,
		Username:       user.Username,
		ChallengeID:    challenge.ID,
		Status:         "running",
		CreatedAt:      instance.CreatedAt,
		ExpiresAt:      instance.ExpiresAt,
		Container:      instance.Container,
		Ports:          ports,
		ConnectionInfo: connectionInfo,
	}

	if payload, err := json.Marshal(event); err == nil {
		utils.WebSocketHub.SendToTeamExcept(user.Team.ID, user.ID, payload)
	}
}

// BuildChallengeImage builds a Docker image for a challenge
func BuildChallengeImage(c *gin.Context) {
	var challenge models.Challenge
	id := c.Param("id")
	result := config.DB.Preload("ChallengeType").First(&challenge, id)
	if result.Error != nil {
		utils.NotFoundError(c, "challenge_not_found")
		return
	}
	if !CheckChallengeDependancies(c, challenge) {
		utils.NotFoundError(c, "challenge_not_found")
		return
	}
	// Check if challenge is of type docker
	if challenge.ChallengeType.Name != "docker" {
		utils.BadRequestError(c, "challenge_not_docker_type")
		return
	}

	// Download the challenge context to a temporary directory
	tmpDir := filepath.Join(os.TempDir(), challenge.Slug)
	defer os.RemoveAll(tmpDir)

	if err := utils.DownloadChallengeContext(challenge.Slug, tmpDir); err != nil {
		utils.InternalServerError(c, fmt.Sprintf("Failed to download challenge context: %v", err))
		return
	}

	// Build the Docker image using the temporary directory as the source
	_, err := utils.BuildDockerImage(challenge.Slug, tmpDir)
	if err != nil {
		utils.InternalServerError(c, err.Error())
		return
	}

	utils.OKResponse(c, gin.H{"message": fmt.Sprintf("Successfully built image for challenge %s", challenge.Slug)})
}

// StartChallengeInstance starts an instance for a challenge
func StartChallengeInstance(c *gin.Context) {
	id := c.Param("id")
	var challenge models.Challenge
	result := config.DB.Preload("ChallengeType").First(&challenge, id)

	if result.Error != nil {
		debug.Log("Challenge not found with ID %s: %v", id, result.Error)
		c.JSON(http.StatusNotFound, gin.H{"error": "challenge_not_found"})
		return
	}
	if !CheckChallengeDependancies(c, challenge) {
		utils.NotFoundError(c, "challenge_not_found")
		return
	}
	handler, ok := GetChallengeHandler(challenge.ChallengeType.Name)
	if !ok {
		debug.Log("No handler registered for challenge type: %s", challenge.ChallengeType.Name)
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported_challenge_type"})
		return
	}

	if err := handler.Start(c, &challenge); err != nil {
		debug.Log("Failed to start challenge: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed_to_start_challenge"})
		return
	}
}

func StopChallengeInstance(c *gin.Context) {
	id := c.Param("id")
	var challenge models.Challenge
	result := config.DB.Preload("ChallengeType").First(&challenge, id)

	if result.Error != nil {
		debug.Log("Challenge not found with ID %s: %v", id, result.Error)
		c.JSON(http.StatusNotFound, gin.H{"error": "challenge_not_found"})
		return
	}
	if !CheckChallengeDependancies(c, challenge) {
		utils.NotFoundError(c, "challenge_not_found")
		return
	}
	handler, ok := GetChallengeHandler(challenge.ChallengeType.Name)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported_challenge_type"})
		return
	}

	if err := handler.Stop(c, &challenge); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed_to_stop_challenge"})
		return
	}
}

// validateInstanceStartPreconditions checks all preconditions for starting instance
func validateInstanceStartPreconditions(c *gin.Context, user models.User, challenge models.Challenge, dockerConfig models.DockerConfig) bool {
	if user.Team == nil || user.TeamID == nil {
		debug.Log("User has no team")
		c.JSON(http.StatusForbidden, gin.H{"error": "team_required"})
		return false
	}

	// Check cooldown
	if allowed, remaining := checkInstanceCooldown(*user.TeamID, challenge.ID, dockerConfig); !allowed {
		c.JSON(http.StatusTooEarly, gin.H{
			"error":             "instance_cooldown_not_elapsed",
			"remaining_seconds": remaining,
		})
		return false
	}

	// Check if instance already exists
	var countExist int64
	config.DB.Model(&models.Instance{}).
		Where(queryTeamAndChallengeID, user.Team.ID, challenge.ID).
		Count(&countExist)
	if countExist >= 1 {
		c.JSON(http.StatusForbidden, gin.H{"error": "instance_already_running"})
		return false
	}

	// Check instance limits
	if err := checkInstanceLimits(user, dockerConfig); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return false
	}

	return true
}

func StartDockerChallengeInstance(c *gin.Context) {
	id := c.Param("id")
	debug.Log("Starting instance for challenge ID: %s", id)

	// Load challenge
	var challenge models.Challenge
	if result := config.DB.Preload("ChallengeType").First(&challenge, id); result.Error != nil {
		debug.Log(errChallengeNotFoundLog, id, result.Error)
		c.JSON(http.StatusNotFound, gin.H{"error": "challenge_not_found"})
		return
	}

	// Ensure image is built
	imageName, err := ensureImageBuiltOrBuild(challenge)
	if err != nil {
		if err.Error() == errDockerUnavailable {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"error":   errDockerUnavailable,
				"message": msgDockerUnavailable,
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	// Get user and validate
	userID, ok := c.Get("user_id")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var dockerConfig models.DockerConfig
	if err := config.DB.First(&dockerConfig).Error; err != nil {
		debug.Log("Docker config not found: %v", err)
		debug.Log("This might be due to missing environment variables or database seeding issues")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "docker_config_not_found"})
		return
	}

	var user models.User
	if err := config.DB.Preload("Team").First(&user, userID).Error; err != nil {
		debug.Log("User not found with ID %v: %v", userID, err)
		c.JSON(http.StatusNotFound, gin.H{"error": "user_not_found"})
		return
	}

	// Validate all preconditions
	if !validateInstanceStartPreconditions(c, user, challenge, dockerConfig) {
		return
	}

	// Allocate ports
	ports, internalPorts, err := allocatePortsForChallenge(challenge)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Ensure Docker connection
	if err := utils.EnsureDockerClientConnected(); err != nil {
		debug.Log("Docker connection failed: %v", err)
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   errDockerUnavailable,
			"message": msgDockerUnavailable,
		})
		return
	}

	// Start container
	containerName, err := utils.StartDockerInstance(imageName, int(*user.TeamID), int(user.ID), internalPorts, ports)
	if err != nil {
		debug.Log("Error starting Docker instance: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Calculate expiration and create instance record
	expiresAt := calculateInstanceExpiration(dockerConfig)
	instance, err := createInstanceRecord(containerName, user, challenge, ports, expiresAt)
	// subnet, _, err := utils.GetTeamSubnet(int(*user.TeamID))
	teamIPs, ipErr := utils.GetTeamIPs(*user.TeamID)
	// teamPorts, portsErr := utils.GetTeamMappedPorts(*user.TeamID)
	if ipErr != nil {
		debug.Log("failed to retrieve team IPs: %v", ipErr)
	} else {
		if err := utils.PushFirewallToAgent(*user.TeamID, ports, teamIPs); err != nil {
			debug.Log("Could not push team firewall config: %v", err)
		}
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "instance_create_failed"})
		return
	}

	// Broadcast to team
	broadcastInstanceStart(instance, user, challenge, ports)

	c.JSON(http.StatusOK, gin.H{
		"status":         "instance_started",
		"image_name":     imageName,
		"container_name": containerName,
		"expires_at":     expiresAt,
		"ports":          ports,
	})
}

// validateComposeInstancePreconditions checks user, team, cooldown, and instance limits
func validateComposeInstancePreconditions(c *gin.Context, userID interface{}, challengeID uint, dockerConfig *models.DockerConfig) (*models.User, error) {
	var user models.User
	if err := config.DB.Preload("Team").First(&user, userID).Error; err != nil {
		return nil, fmt.Errorf("user_not_found")
	}

	if user.Team == nil || user.TeamID == nil {
		// Admins get a clearer message - they need to join a team for Docker instances
		if user.Role == "admin" {
			return nil, fmt.Errorf("admin_team_required_for_instances")
		}
		return nil, fmt.Errorf("team_required")
	}

	// Check cooldown
	if dockerConfig.InstanceCooldownSeconds > 0 {
		var cd models.InstanceCooldown
		if err := config.DB.Where("team_id = ? AND challenge_id = ?", *user.TeamID, challengeID).First(&cd).Error; err == nil {
			elapsed := time.Since(cd.LastStoppedAt)
			remaining := time.Duration(dockerConfig.InstanceCooldownSeconds)*time.Second - elapsed
			if remaining > 0 {
				return nil, fmt.Errorf("cooldown:%d", int(remaining.Seconds()))
			}
		}
	}

	// Check instance limits
	var countExist, countUser, countTeam int64
	config.DB.Model(&models.Instance{}).Where("team_id = ? AND challenge_id = ?", user.Team.ID, challengeID).Count(&countExist)
	config.DB.Model(&models.Instance{}).Where("user_id = ?", user.ID).Count(&countUser)
	config.DB.Model(&models.Instance{}).Where("team_id = ?", user.Team.ID).Count(&countTeam)

	if countExist > 0 {
		return nil, fmt.Errorf("instance_already_running")
	}
	if int(countUser) >= dockerConfig.InstancesByUser {
		return nil, fmt.Errorf("max_instances_by_user_reached")
	}
	if int(countTeam) >= dockerConfig.InstancesByTeam {
		return nil, fmt.Errorf("max_instances_by_team_reached")
	}

	return &user, nil
}

// prepareComposeProject creates and configures the compose project
func prepareComposeProject(challengeSlug string, teamID, userID int) (interface{}, error) {
	compose, err := utils.GetComposeFile(challengeSlug)
	if err != nil {
		return nil, fmt.Errorf("get_compose_failed: %w", err)
	}

	project, err := utils.CreateComposeProject(challengeSlug, teamID, userID, compose)
	if err != nil {
		return nil, fmt.Errorf("create_compose_failed: %w", err)
	}

	return project, nil
}

func StartComposeChallengeInstance(c *gin.Context) {
	id := c.Param("id")
	debug.Log("Starting instance for compose challenge ID: %s", id)

	// Load challenge
	var challenge models.Challenge
	result := config.DB.Preload("ChallengeType").First(&challenge, id)
	if result.Error != nil {
		debug.Log("Challenge not found with ID %s: %v", id, result.Error)
		c.JSON(http.StatusNotFound, gin.H{"error": "challenge_not_found"})
		return
	}

	userID, ok := c.Get("user_id")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	// Load docker config
	var dockerConfig models.DockerConfig
	if err := config.DB.First(&dockerConfig).Error; err != nil {
		debug.Log("Docker config not found: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "docker_config_not_found"})
		return
	}

	// Validate preconditions
	user, err := validateComposeInstancePreconditions(c, userID, challenge.ID, &dockerConfig)
	if err != nil {
		if strings.HasPrefix(err.Error(), "cooldown:") {
			var remaining int
			fmt.Sscanf(err.Error(), "cooldown:%d", &remaining)
			c.JSON(http.StatusTooEarly, gin.H{
				"error":             "instance_cooldown_not_elapsed",
				"remaining_seconds": remaining,
			})
		} else {
			status := http.StatusInternalServerError
			if err.Error() == "user_not_found" {
				status = http.StatusNotFound
			} else if err.Error() == "team_required" || strings.Contains(err.Error(), "already_running") || strings.Contains(err.Error(), "max_instances") {
				status = http.StatusForbidden
			}
			c.JSON(status, gin.H{"error": err.Error()})
		}
		return
	}

	// Ensure Docker is available
	if err := utils.EnsureDockerClientConnected(); err != nil {
		debug.Log("Docker connection failed: %v", err)
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   "docker_unavailable",
			"message": "Docker service unavailable.",
		})
		return
	}

	// Prepare compose project
	projectInterface, err := prepareComposeProject(challenge.Slug, int(*user.TeamID), int(user.ID))
	if err != nil {
		debug.Log("Compose preparation failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Randomize ports
	ports, err := utils.RandomizeServicePorts(projectInterface.(*types.Project))
	if err != nil {
		debug.Log("RandomizeServicePorts failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "randomize_ports_failed"})
		return
	}

	// Calculate expiration and create instance record first
	expiresAt := calculateInstanceExpiration(dockerConfig)
	projectName := fmt.Sprintf("%s_%d_%d", challenge.Slug, *user.TeamID, user.ID)
	instance, err := createInstanceRecord(projectName, *user, challenge, ports, expiresAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Respond immediately to avoid timeout
	c.JSON(http.StatusOK, gin.H{
		"status":     "compose_instance_starting",
		"project":    projectName,
		"expires_at": expiresAt,
		"ports":      ports,
	})

	// Start the compose instance asynchronously (takes 10+ seconds)
	go func() {
		if err := utils.StartComposeInstance(projectInterface.(*types.Project), int(*user.TeamID)); err != nil {
			debug.Log("StartComposeInstance failed: %v", err)
			// Clean up the instance record on failure
			config.DB.Delete(&instance)
			return
		}
		teamIPs, ipErr := utils.GetTeamIPs(*user.TeamID)
		if ipErr != nil {
			debug.Log("failed to retrieve team IPs: %v", ipErr)
		} else {
			if err := utils.PushFirewallToAgent(*user.TeamID, ports, teamIPs); err != nil {
				debug.Log("Could not push team firewall config: %v", err)
			}
		}
		// Broadcast instance start after successful startup
		broadcastInstanceStart(instance, *user, challenge, ports)
		debug.Log("Compose instance started successfully: %s", projectName)
	}()
}

// broadcastInstanceStop sends WebSocket notification about instance stop
func broadcastInstanceStop(userID interface{}, instance *models.Instance) {
	if utils.WebSocketHub == nil {
		return
	}

	var user models.User
	if err := config.DB.Select("id, username, team_id").First(&user, userID).Error; err != nil || user.TeamID == nil {
		return
	}

	type InstanceEvent struct {
		Event       string    `json:"event"`
		TeamID      uint      `json:"teamId"`
		UserID      uint      `json:"userId"`
		Username    string    `json:"username"`
		ChallengeID uint      `json:"challengeId"`
		Status      string    `json:"status"`
		UpdatedAt   time.Time `json:"updatedAt"`
	}

	event := InstanceEvent{
		Event:       "instance_update",
		TeamID:      *user.TeamID,
		UserID:      user.ID,
		Username:    user.Username,
		ChallengeID: instance.ChallengeID,
		Status:      "stopped",
		UpdatedAt:   time.Now().UTC(),
	}

	if payload, err := json.Marshal(event); err == nil {
		debug.Log("[WebSocket] Broadcasting instance_update (stopped) for challenge %d to team %d", instance.ChallengeID, *user.TeamID)
		utils.WebSocketHub.SendToTeam(*user.TeamID, payload)
		debug.Log("[WebSocket] Broadcast sent successfully")
	} else {
		debug.Log("[WebSocket] Failed to marshal event: %v", err)
	}
}

// getUserAndTeamForStatus retrieves user and validates team membership
func getUserAndTeamForStatus(userID interface{}) (*models.User, error) {
	var user models.User
	if err := config.DB.Preload("Team").First(&user, userID).Error; err != nil {
		return nil, fmt.Errorf("user_not_found")
	}

	if user.Team == nil || user.TeamID == nil {
		return &user, fmt.Errorf("no_team")
	}

	return &user, nil
}

// getInstanceForTeam retrieves the instance for a team and challenge
func getInstanceForTeam(teamID uint, challengeID string) (*models.Instance, error) {
	var instance models.Instance
	if err := config.DB.Where("team_id = ? AND challenge_id = ?", teamID, challengeID).First(&instance).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("no_instance")
		}
		return nil, err
	}
	return &instance, nil
}

// checkAndUpdateExpiredInstance checks if instance is expired and updates status
func checkAndUpdateExpiredInstance(instance *models.Instance) bool {
	isExpired := time.Now().After(instance.ExpiresAt)
	if isExpired && instance.Status == "running" {
		instance.Status = "expired"
		config.DB.Save(instance)
	}
	return isExpired
}

// buildConnectionInfoForInstance builds connection info with actual ports
func buildConnectionInfoForInstance(challenge *models.Challenge, instance *models.Instance) []string {
	var connectionInfo []string

	if instance.Status != "running" || len(challenge.ConnectionInfo) == 0 {
		return connectionInfo
	}

	ip := os.Getenv("PTA_DOCKER_WORKER_IP")
	if ip == "" {
		ip = "instance-ip"
	}

	instancePorts := make([]int, len(instance.Ports))
	for i, p := range instance.Ports {
		instancePorts[i] = int(p)
	}

	debug.Log("Starting port mapping for challenge %v", instancePorts)

	for i, info := range challenge.ConnectionInfo {
		formattedInfo := strings.ReplaceAll(info, "$ip", ip)
		if i < len(instancePorts) {
			for j, originalPort := range challenge.Ports {
				if j < len(instancePorts) {
					originalPortStr := fmt.Sprintf("[%d]", originalPort)
					newPortStr := fmt.Sprintf("%d", instancePorts[j])
					formattedInfo = strings.ReplaceAll(formattedInfo, originalPortStr, newPortStr)
				}
			}
		}
		connectionInfo = append(connectionInfo, formattedInfo)
	}

	return connectionInfo
}

// GetInstanceStatus returns the status of a challenge instance for a team
func GetInstanceStatus(c *gin.Context) {
	challengeID := c.Param("id")
	userID, ok := c.Get("user_id")
	if !ok {
		utils.UnauthorizedError(c, "unauthorized")
		return
	}

	// Get user and validate team
	user, err := getUserAndTeamForStatus(userID)
	if err != nil {
		if err.Error() == "user_not_found" {
			utils.NotFoundError(c, "user_not_found")
			return
		}
		if err.Error() == "no_team" {
			utils.OKResponse(c, gin.H{
				"has_instance": false,
				"status":       "no_team",
			})
			return
		}
	}

	// Get instance for team
	instance, err := getInstanceForTeam(user.Team.ID, challengeID)
	if err != nil {
		if err.Error() == "no_instance" {
			utils.OKResponse(c, gin.H{
				"has_instance": false,
				"status":       "no_instance",
			})
			return
		}
		debug.Log("Database error when checking instance status: %v", err)
		utils.InternalServerError(c, "database_error")
		return
	}

	// Check and update expired status
	isExpired := checkAndUpdateExpiredInstance(instance)

	// Load challenge
	var challenge models.Challenge
	if err := config.DB.First(&challenge, challengeID).Error; err != nil {
		utils.InternalServerError(c, "challenge_not_found")
		return
	}

	// Build connection info
	connectionInfo := buildConnectionInfoForInstance(&challenge, instance)

	utils.OKResponse(c, gin.H{
		"has_instance":    true,
		"status":          instance.Status,
		"created_at":      instance.CreatedAt,
		"expires_at":      instance.ExpiresAt,
		"is_expired":      isExpired,
		"container":       instance.Container,
		"ports":           instance.Ports,
		"connection_info": connectionInfo,
	})
}

func StopDockerChallengeInstance(c *gin.Context) {
	challengeID := c.Param("id")
	userID, ok := c.Get("user_id")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var user models.User
	if err := config.DB.Select("id, team_id").First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user_not_found"})
		return
	}

	var instance models.Instance
	teamID := uint(0)
	if user.TeamID != nil {
		teamID = *user.TeamID
	}

	if err := config.DB.Where("challenge_id = ? AND team_id = ?", challengeID, teamID).First(&instance).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "instance_not_found"})
		return
	}

	if instance.UserID != user.ID && (user.TeamID == nil || instance.TeamID != *user.TeamID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	if instance.TeamID != 0 {
		now := time.Now().UTC()
		var cd models.InstanceCooldown
		if err := config.DB.Where("team_id = ? AND challenge_id = ?", instance.TeamID, instance.ChallengeID).First(&cd).Error; err == nil {
			cd.LastStoppedAt = now
			_ = config.DB.Save(&cd).Error
		} else {
			_ = config.DB.Create(&models.InstanceCooldown{
				TeamID:        instance.TeamID,
				ChallengeID:   instance.ChallengeID,
				LastStoppedAt: now,
			}).Error
		}
	}

	go func() {
		if err := utils.StopDockerInstance(instance.Container); err != nil {
			debug.Log("Failed to stop Docker instance: %v", err)
		}
		if err := config.DB.Delete(&instance).Error; err != nil {
			debug.Log("Failed to delete instance from DB: %v", err)
		}
		// Broadcast after actual stop - same pattern as Compose challenges
		broadcastInstanceStop(userID, &instance)
		debug.Log("Docker instance stopped and broadcast sent: %s", instance.Container)
	}()

	c.JSON(http.StatusOK, gin.H{
		"message":   "instance_stopped",
		"container": instance.Container,
	})
}

func StopComposeChallengeInstance(c *gin.Context) {
	challengeID := c.Param("id")
	userID, ok := c.Get("user_id")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var user models.User
	if err := config.DB.Select("id, team_id").First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user_not_found"})
		return
	}

	var instance *models.Instance
	teamID := uint(0)
	if user.TeamID != nil {
		teamID = *user.TeamID
	}

	if err := config.DB.Where("challenge_id = ? AND team_id = ?", challengeID, teamID).First(&instance).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "instance_not_found"})
		return
	}

	if instance.UserID != user.ID && (user.TeamID == nil || instance.TeamID != *user.TeamID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	if instance.TeamID != 0 {
		now := time.Now().UTC()
		var cd models.InstanceCooldown
		if err := config.DB.Where("team_id = ? AND challenge_id = ?", instance.TeamID, instance.ChallengeID).First(&cd).Error; err == nil {
			cd.LastStoppedAt = now
			_ = config.DB.Save(&cd).Error
		} else {
			_ = config.DB.Create(&models.InstanceCooldown{
				TeamID:        instance.TeamID,
				ChallengeID:   instance.ChallengeID,
				LastStoppedAt: now,
			}).Error
		}
	}

	go func() {
		if err := utils.StopComposeInstance(instance.Container); err != nil {
			debug.Log("Failed to stop Compose instance: %v", err)
			return
		}
		if err := config.DB.Delete(instance).Error; err != nil {
			debug.Log("Failed to delete Compose instance from DB: %v", err)
			return
		}
		broadcastInstanceStop(userID, instance)
		debug.Log("Compose instance stopped and broadcast sent: %s", instance.Container)
	}()

	c.JSON(http.StatusOK, gin.H{
		"message":   "instance_stopped",
		"container": instance.Container,
	})
}
