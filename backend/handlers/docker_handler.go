package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/lib/pq"
	"github.com/pwnthemall/pwnthemall/backend/config"
	"github.com/pwnthemall/pwnthemall/backend/debug"
	"github.com/pwnthemall/pwnthemall/backend/models"
	"github.com/pwnthemall/pwnthemall/backend/shared"
	"github.com/pwnthemall/pwnthemall/backend/utils"
	"gorm.io/gorm"
)

type dockerChallengeHandler struct{}

// ensureImageBuiltOrBuild checks if Docker image exists, builds if necessary
func (h *dockerChallengeHandler) ensureImageBuiltOrBuild(challenge shared.Challenge) (string, error) {
	imageName, exists := utils.IsImageBuilt(challenge.GetSlug())
	if exists {
		return imageName, nil
	}

	if err := utils.EnsureDockerClientConnected(); err != nil {
		debug.Log("Docker connection failed for challenge %s: %v", challenge.GetSlug(), err)
		return "", fmt.Errorf("docker_unavailable")
	}

	tmpDir := filepath.Join(os.TempDir(), challenge.GetSlug())
	if err := utils.DownloadChallengeContext(challenge.GetSlug(), tmpDir); err != nil {
		debug.Log("Failed to download challenge context: %v", err)
		os.RemoveAll(tmpDir)
		return "", fmt.Errorf("failed_to_download_challenge")
	}
	defer os.RemoveAll(tmpDir)

	imageName, err := utils.BuildDockerImage(challenge.GetSlug(), tmpDir)
	if err != nil {
		debug.Log("Docker build failed for challenge %s: %v", challenge.GetSlug(), err)
		return "", fmt.Errorf("docker_build_failed")
	}

	debug.Log("Image built successfully: %s", imageName)
	return imageName, nil
}

// validateInstanceStartPreconditions checks all preconditions for starting instance
func (h *dockerChallengeHandler) validateInstanceStartPreconditions(c *gin.Context, user models.User, challengeID uint, dockerConfig models.DockerConfig) bool {
	if user.Team == nil || user.TeamID == nil {
		debug.Log("User has no team")
		c.JSON(http.StatusForbidden, gin.H{"error": "team_required"})
		return false
	}

	// Check cooldown
	if dockerConfig.InstanceCooldownSeconds > 0 {
		var cd models.InstanceCooldown
		if err := config.DB.Where("team_id = ? AND challenge_id = ?", *user.TeamID, challengeID).First(&cd).Error; err == nil {
			elapsed := time.Since(cd.LastStoppedAt)
			remaining := time.Duration(dockerConfig.InstanceCooldownSeconds)*time.Second - elapsed
			if remaining > 0 {
				c.JSON(http.StatusTooEarly, gin.H{
					"error":             "instance_cooldown_not_elapsed",
					"remaining_seconds": int(remaining.Seconds()),
				})
				return false
			}
		}
	}

	// Check if instance already exists - return existing instance info instead of error
	var existingInstance models.Instance
	if err := config.DB.Where("team_id = ? AND challenge_id = ?", user.Team.ID, challengeID).First(&existingInstance).Error; err == nil {
		// Instance exists, return its info as success
		c.JSON(http.StatusOK, gin.H{
			"status":     "instance_already_running",
			"name":       existingInstance.Container,
			"ports":      existingInstance.Ports,
			"expires_at": existingInstance.ExpiresAt,
		})
		return false
	}

	// Check user limit
	var countUser int64
	config.DB.Model(&models.Instance{}).Where("user_id = ?", user.ID).Count(&countUser)
	if int(countUser) >= dockerConfig.InstancesByUser {
		c.JSON(http.StatusForbidden, gin.H{"error": "max_instances_by_user_reached"})
		return false
	}

	// Check team limit
	var countTeam int64
	config.DB.Model(&models.Instance{}).Where("team_id = ?", user.Team.ID).Count(&countTeam)
	if int(countTeam) >= dockerConfig.InstancesByTeam {
		c.JSON(http.StatusForbidden, gin.H{"error": "max_instances_by_team_reached"})
		return false
	}

	return true
}

func (h *dockerChallengeHandler) Start(c *gin.Context, challenge shared.Challenge) error {
	debug.Log("Starting Docker instance for challenge ID: %d", challenge.GetID())

	// Ensure image is built
	imageName, err := h.ensureImageBuiltOrBuild(challenge)
	if err != nil {
		if err.Error() == "docker_unavailable" {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"error":   "docker_unavailable",
				"message": "Docker service is currently unavailable.",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return err
	}

	// Get user
	userID, ok := c.Get("user_id")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return fmt.Errorf("unauthorized")
	}

	var dockerConfig models.DockerConfig
	if err := config.DB.First(&dockerConfig).Error; err != nil {
		debug.Log("Docker config not found: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "docker_config_not_found"})
		return err
	}

	var user models.User
	if err := config.DB.Preload("Team").First(&user, userID).Error; err != nil {
		debug.Log("User not found with ID %v: %v", userID, err)
		c.JSON(http.StatusNotFound, gin.H{"error": "user_not_found"})
		return err
	}

	// Validate preconditions
	if !h.validateInstanceStartPreconditions(c, user, challenge.GetID(), dockerConfig) {
		return fmt.Errorf("preconditions_failed")
	}

	// Allocate ports
	ports := challenge.GetPorts()
	portCount := len(ports)
	if portCount == 0 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "no_ports_defined_for_challenge"})
		return fmt.Errorf("no_ports_defined")
	}

	hostPorts, err := utils.FindAvailablePorts(portCount)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "no_free_ports"})
		return err
	}

	internalPorts := make([]int, len(ports))
	for i, p := range ports {
		internalPorts[i] = int(p)
	}

	// Ensure Docker connection
	if err := utils.EnsureDockerClientConnected(); err != nil {
		debug.Log("Docker connection failed: %v", err)
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   "docker_unavailable",
			"message": "Docker service is currently unavailable.",
		})
		return err
	}

	// Start container
	containerName, err := utils.StartDockerInstance(imageName, int(*user.TeamID), int(user.ID), internalPorts, hostPorts)
	if err != nil {
		debug.Log("Error starting Docker instance: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return err
	}

	// Calculate expiration
	var expiresAt time.Time
	if dockerConfig.InstanceTimeout > 0 {
		expiresAt = time.Now().Add(time.Duration(dockerConfig.InstanceTimeout) * time.Minute)
	} else {
		expiresAt = time.Now().Add(24 * time.Hour)
	}

	// Create instance record
	ports64 := make(pq.Int64Array, len(hostPorts))
	for i, p := range hostPorts {
		ports64[i] = int64(p)
	}

	instance := models.Instance{
		Name:        containerName,
		UserID:      user.ID,
		TeamID:      *user.TeamID,
		ChallengeID: challenge.GetID(),
		Ports:       ports64,
		CreatedAt:   time.Now(),
		ExpiresAt:   expiresAt,
		Status:      "running",
	}

	if err := config.DB.Create(&instance).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "instance_create_failed"})
		return err
	}

	// Push firewall rules
	teamIPs, ipErr := utils.GetTeamIPs(*user.TeamID)
	if ipErr != nil {
		debug.Log("failed to retrieve team IPs: %v", ipErr)
	} else {
		if err := utils.PushFirewallToAgent(*user.TeamID, hostPorts, teamIPs); err != nil {
			debug.Log("Could not push team firewall config: %v", err)
		}
	}

	// Broadcast to team
	h.broadcastInstanceStart(&instance, user, challenge, hostPorts)

	c.JSON(http.StatusOK, gin.H{
		"status":         "instance_started",
		"image_name":     imageName,
		"name": containerName,
		"expires_at":     expiresAt,
		"ports":          hostPorts,
	})

	return nil
}

func (h *dockerChallengeHandler) Stop(c *gin.Context, challenge shared.Challenge) error {
	challengeID := c.Param("id")
	userID, ok := c.Get("user_id")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return fmt.Errorf("unauthorized")
	}

	var user models.User
	if err := config.DB.Select("id, team_id").First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user_not_found"})
		return err
	}

	var instance models.Instance
	teamID := uint(0)
	if user.TeamID != nil {
		teamID = *user.TeamID
	}

	if err := config.DB.Where("challenge_id = ? AND team_id = ?", challengeID, teamID).First(&instance).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "instance_not_found"})
		return err
	}

	if instance.UserID != user.ID && (user.TeamID == nil || instance.TeamID != *user.TeamID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return fmt.Errorf("forbidden")
	}

	// Record cooldown
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
		if err := utils.StopDockerInstance(instance.Name); err != nil {
			debug.Log("Failed to stop Docker instance: %v", err)
		}
		if err := config.DB.Delete(&instance).Error; err != nil {
			debug.Log("Failed to delete instance from DB: %v", err)
		}
		h.broadcastInstanceStop(userID, &instance)
		debug.Log("Docker instance stopped and broadcast sent: %s", instance.Name)
	}()

	c.JSON(http.StatusOK, gin.H{
		"message": "instance_stopped",
		"name":    instance.Name,
	})

	return nil
}

func (h *dockerChallengeHandler) GetStatus(c *gin.Context, challenge shared.Challenge) error {
	challengeID := c.Param("id")
	userID, ok := c.Get("user_id")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return fmt.Errorf("unauthorized")
	}

	var user models.User
	if err := config.DB.Preload("Team").First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user_not_found"})
		return err
	}

	if user.Team == nil || user.TeamID == nil {
		c.JSON(http.StatusOK, gin.H{
			"has_instance": false,
			"status":       "no_team",
		})
		return nil
	}

	var instance models.Instance
	if err := config.DB.Where("team_id = ? AND challenge_id = ?", user.Team.ID, challengeID).First(&instance).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusOK, gin.H{
				"has_instance": false,
				"status":       "no_instance",
			})
			return nil
		}
		debug.Log("Database error when checking instance status: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database_error"})
		return err
	}

	isExpired := time.Now().After(instance.ExpiresAt)
	if isExpired && instance.Status == "running" {
		instance.Status = "expired"
		config.DB.Save(&instance)
	}

	// Load full challenge for connection info
	var fullChallenge models.Challenge
	if err := config.DB.First(&fullChallenge, challengeID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "challenge_not_found"})
		return err
	}

	connectionInfo := h.buildConnectionInfo(&fullChallenge, &instance)

	c.JSON(http.StatusOK, gin.H{
		"has_instance":    true,
		"status":          instance.Status,
		"created_at":      instance.CreatedAt,
		"expires_at":      instance.ExpiresAt,
		"is_expired":      isExpired,
		"name":            instance.Name,
		"ports":           instance.Ports,
		"connection_info": connectionInfo,
	})

	return nil
}

// Helper methods

func (h *dockerChallengeHandler) buildConnectionInfo(challenge *models.Challenge, instance *models.Instance) []string {
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

func (h *dockerChallengeHandler) broadcastInstanceStart(instance *models.Instance, user models.User, challenge shared.Challenge, ports []int) {
	if utils.WebSocketHub == nil {
		return
	}

	ip := os.Getenv("PTA_DOCKER_WORKER_IP")
	if ip == "" {
		ip = "worker-ip"
	}

	var connectionInfo []string
	challengePorts := challenge.GetPorts()
	challengeConnInfo := challenge.GetConnectionInfo()

	for i, info := range challengeConnInfo {
		formattedInfo := strings.ReplaceAll(info, "$ip", ip)
		if i < len(ports) {
			for j, originalPort := range challengePorts {
				if j < len(ports) {
					originalPortStr := fmt.Sprintf(":%d", originalPort)
					newPortStr := fmt.Sprintf(":%d", ports[j])
					formattedInfo = strings.ReplaceAll(formattedInfo, originalPortStr, newPortStr)
				}
			}
		}
		connectionInfo = append(connectionInfo, formattedInfo)
	}

	type InstanceEvent struct {
		Event          string    `json:"event"`
		TeamID         uint      `json:"teamId"`
		UserID         uint      `json:"userId"`
		Username       string    `json:"username"`
		ChallengeID    uint      `json:"challengeId"`
		Status         string    `json:"status"`
		CreatedAt      time.Time `json:"createdAt"`
		ExpiresAt      time.Time `json:"expiresAt"`
		Name           string    `json:"name"`
		Ports          []int     `json:"ports"`
		ConnectionInfo []string  `json:"connectionInfo"`
	}

	event := InstanceEvent{
		Event:          "instance_update",
		TeamID:         user.Team.ID,
		UserID:         user.ID,
		Username:       user.Username,
		ChallengeID:    challenge.GetID(),
		Status:         "running",
		CreatedAt:      instance.CreatedAt,
		ExpiresAt:      instance.ExpiresAt,
		Name:           instance.Name,
		Ports:          ports,
		ConnectionInfo: connectionInfo,
	}

	if payload, err := json.Marshal(event); err == nil {
		utils.WebSocketHub.SendToTeamExcept(user.Team.ID, user.ID, payload)
	}
}

func (h *dockerChallengeHandler) broadcastInstanceStop(userID interface{}, instance *models.Instance) {
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
		utils.WebSocketHub.SendToTeam(*user.TeamID, payload)
	}
}

func init() {
	shared.RegisterChallengeHandler("docker", &dockerChallengeHandler{})
}
