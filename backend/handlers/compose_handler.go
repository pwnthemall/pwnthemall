package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/compose-spec/compose-go/v2/types"
	"github.com/gin-gonic/gin"
	"github.com/lib/pq"
	"github.com/pwnthemall/pwnthemall/backend/config"
	"github.com/pwnthemall/pwnthemall/backend/debug"
	"github.com/pwnthemall/pwnthemall/backend/models"
	"github.com/pwnthemall/pwnthemall/backend/shared"
	"github.com/pwnthemall/pwnthemall/backend/utils"
	"gorm.io/gorm"
)

type composeChallengeHandler struct{}

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

func (h *composeChallengeHandler) Start(c *gin.Context, challenge shared.Challenge) error {
	debug.Log("Starting Compose instance for challenge ID: %d", challenge.GetID())

	// Get user
	userID, ok := c.Get("user_id")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return fmt.Errorf("unauthorized")
	}

	// Load docker config
	var dockerConfig models.DockerConfig
	if err := config.DB.First(&dockerConfig).Error; err != nil {
		debug.Log("Docker config not found: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "docker_config_not_found"})
		return err
	}

	// Validate preconditions
	user, err := h.validatePreconditions(c, userID, challenge.GetID(), &dockerConfig)
	if err != nil {
		return err
	}

	// Ensure Docker is available
	if err := utils.EnsureDockerClientConnected(); err != nil {
		debug.Log("Docker connection failed: %v", err)
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   "docker_unavailable",
			"message": "Docker service unavailable.",
		})
		return err
	}

	project, err := prepareComposeProject(challenge.GetSlug(), int(*user.TeamID), int(user.ID))
	if err != nil {
		debug.Log("CreateComposeProject failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "create_compose_failed"})
		return err
	}

	// Randomize ports
	ports, err := utils.RandomizeServicePorts(project.(*types.Project))
	if err != nil {
		debug.Log("RandomizeServicePorts failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "randomize_ports_failed"})
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
	projectName := fmt.Sprintf("%s_%d_%d", challenge.GetSlug(), *user.TeamID, user.ID)
	ports64 := make(pq.Int64Array, len(ports))
	for i, p := range ports {
		ports64[i] = int64(p)
	}

	instance := models.Instance{
		Name:        projectName,
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

	// Respond immediately to avoid timeout
	c.JSON(http.StatusOK, gin.H{
		"status":     "compose_instance_starting",
		"project":    projectName,
		"expires_at": expiresAt,
		"ports":      ports,
	})

	// Start compose asynchronously (takes 10+ seconds)
	go func() {
		if err := utils.StartComposeInstance(project.(*types.Project), int(*user.TeamID)); err != nil {
			debug.Log("StartComposeInstance failed: %v", err)
			config.DB.Delete(&instance)
			return
		}

		// Push firewall
		teamIPs, ipErr := utils.GetTeamIPs(*user.TeamID)
		if ipErr != nil {
			debug.Log("failed to retrieve team IPs: %v", ipErr)
		} else {
			if err := utils.PushFirewallToAgent(*user.TeamID, ports, teamIPs); err != nil {
				debug.Log("Could not push team firewall config: %v", err)
			}
		}

		// Broadcast instance start after successful startup
		h.broadcastInstanceStart(&instance, *user, challenge, ports)
		debug.Log("Compose instance started successfully: %s", projectName)
	}()

	return nil
}

func (h *composeChallengeHandler) Stop(c *gin.Context, challenge shared.Challenge) error {
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
		if err := utils.StopComposeInstance(instance.Name); err != nil {
			debug.Log("Failed to stop Compose instance: %v", err)
			return
		}
		if err := config.DB.Delete(&instance).Error; err != nil {
			debug.Log("Failed to delete Compose instance from DB: %v", err)
			return
		}
		h.broadcastInstanceStop(userID, &instance)
		debug.Log("Compose instance stopped and broadcast sent: %s", instance.Name)
	}()

	c.JSON(http.StatusOK, gin.H{
		"message": "instance_stopped",
		"name":    instance.Name,
	})

	return nil
}

func (h *composeChallengeHandler) GetStatus(c *gin.Context, challenge shared.Challenge) error {
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

func (h *composeChallengeHandler) validatePreconditions(c *gin.Context, userID interface{}, challengeID uint, dockerConfig *models.DockerConfig) (*models.User, error) {
	var user models.User
	if err := config.DB.Preload("Team").First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user_not_found"})
		return nil, fmt.Errorf("user_not_found")
	}

	if user.Team == nil || user.TeamID == nil {
		if user.Role == "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "admin_team_required_for_instances"})
			return nil, fmt.Errorf("admin_team_required")
		}
		c.JSON(http.StatusForbidden, gin.H{"error": "team_required"})
		return nil, fmt.Errorf("team_required")
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
				return nil, fmt.Errorf("cooldown_active")
			}
		}
	}

	// Check if instance already exists
	var countExist, countUser, countTeam int64
	config.DB.Model(&models.Instance{}).Where("team_id = ? AND challenge_id = ?", user.Team.ID, challengeID).Count(&countExist)
	config.DB.Model(&models.Instance{}).Where("user_id = ?", user.ID).Count(&countUser)
	config.DB.Model(&models.Instance{}).Where("team_id = ?", user.Team.ID).Count(&countTeam)

	if countExist > 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "instance_already_running"})
		return nil, fmt.Errorf("instance_already_running")
	}
	if int(countUser) >= dockerConfig.InstancesByUser {
		c.JSON(http.StatusForbidden, gin.H{"error": "max_instances_by_user_reached"})
		return nil, fmt.Errorf("max_instances_by_user_reached")
	}
	if int(countTeam) >= dockerConfig.InstancesByTeam {
		c.JSON(http.StatusForbidden, gin.H{"error": "max_instances_by_team_reached"})
		return nil, fmt.Errorf("max_instances_by_team_reached")
	}

	return &user, nil
}

func (h *composeChallengeHandler) buildConnectionInfo(challenge *models.Challenge, instance *models.Instance) []string {
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

func (h *composeChallengeHandler) broadcastInstanceStart(instance *models.Instance, user models.User, challenge shared.Challenge, ports []int) {
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

func (h *composeChallengeHandler) broadcastInstanceStop(userID interface{}, instance *models.Instance) {
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

func init() {
	shared.RegisterChallengeHandler("compose", &composeChallengeHandler{})
}
