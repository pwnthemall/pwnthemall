package pluginsystem

import (
	"encoding/json"
	"fmt"

	"github.com/gin-gonic/gin"
	"github.com/pwnthemall/pwnthemall/backend/config"
	"github.com/pwnthemall/pwnthemall/backend/models"
	"github.com/pwnthemall/pwnthemall/backend/shared"
)

// PluginChallengeHandler adapte un handler de plugin pour le registry du backend
type PluginChallengeHandler struct {
	plugin        shared.Plugin
	challengeType string
}

func (h *PluginChallengeHandler) Start(c *gin.Context, challenge shared.Challenge) error {
	return h.executeAction("start", c, challenge)
}

func (h *PluginChallengeHandler) Stop(c *gin.Context, challenge shared.Challenge) error {
	return h.executeAction("stop", c, challenge)
}

func (h *PluginChallengeHandler) GetStatus(c *gin.Context, challenge shared.Challenge) error {
	return h.executeAction("status", c, challenge)
}

func (h *PluginChallengeHandler) executeAction(action string, c *gin.Context, challenge shared.Challenge) error {
	userID, _ := c.Get("user_id")
	var teamID uint

	var user models.User
	if err := config.DB.Preload("Team").First(&user, userID).Error; err == nil && user.TeamID != nil {
		teamID = *user.TeamID
	}

	var containerName string
	if action == "status" {
		var instance models.Instance
		if err := config.DB.Where("team_id = ? AND challenge_id = ?", teamID, challenge.GetID()).First(&instance).Error; err == nil {
			containerName = instance.Name
		}
	}

	challengeData := map[string]interface{}{
		"id":             challenge.GetID(),
		"slug":           challenge.GetSlug(),
		"challenge_type": challenge.GetType(),
		"action":         action,
		"instance":      containerName,
	}

	body, _ := json.Marshal(challengeData)

	requestData := shared.RequestData{
		Method:  "POST",
		Path:    fmt.Sprintf("/internal/challenge/%s", action),
		Headers: c.Request.Header,
		Body:    body,
		Query:   make(map[string][]string),
	}

	requestData.Query["team_id"] = []string{fmt.Sprintf("%d", teamID)}
	requestData.Query["user_id"] = []string{fmt.Sprintf("%d", userID)}
	requestData.Query["container"] = []string{containerName}

	if rpcPlugin, ok := h.plugin.(*shared.PluginRPC); ok {
		handlerName := fmt.Sprintf("ChallengeInstance%s", action)
		response, err := rpcPlugin.HandleRequest(handlerName, requestData)
		if err != nil {
			return err
		}

		for key, value := range response.Headers {
			c.Header(key, value)
		}
		c.Data(response.StatusCode, "application/json", response.Body)
		return nil
	}

	return fmt.Errorf("plugin does not implement RPC interface")
}

// RegisterPluginChallengeHandler registers a plugin as a challenge handler
func RegisterPluginChallengeHandler(plugin shared.Plugin, challengeType string) {
	handler := &PluginChallengeHandler{
		plugin:        plugin,
		challengeType: challengeType,
	}
	shared.RegisterChallengeHandler(challengeType, handler)
}
