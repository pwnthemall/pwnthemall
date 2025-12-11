package pluginsystem

import (
	"encoding/json"
	"fmt"
	"log"

	"github.com/gin-gonic/gin"
	"github.com/pwnthemall/pwnthemall/backend/config"
	"github.com/pwnthemall/pwnthemall/backend/models"
	"github.com/pwnthemall/pwnthemall/backend/shared"
	"github.com/pwnthemall/pwnthemall/backend/utils"
	"gopkg.in/yaml.v2"
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

// convertToStringKeys converts YAML-parsed structures (which may contain map[interface{}]interface{})
// into map[string]interface{} / []interface{} recursively so json.Marshal works.
func convertToStringKeys(i interface{}) interface{} {
	switch v := i.(type) {
	case map[interface{}]interface{}:
		m := make(map[string]interface{}, len(v))
		for k, val := range v {
			m[fmt.Sprintf("%v", k)] = convertToStringKeys(val)
		}
		return m
	case map[string]interface{}:
		m := make(map[string]interface{}, len(v))
		for k, val := range v {
			m[k] = convertToStringKeys(val)
		}
		return m
	case []interface{}:
		arr := make([]interface{}, len(v))
		for idx, el := range v {
			arr[idx] = convertToStringKeys(el)
		}
		return arr
	default:
		return v
	}
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
		"instance":       containerName,
	}

	slug := challenge.GetSlug()
	if slug != "" {
		tryKeys := []string{
			fmt.Sprintf("%s/chall.yml", slug),
		}
		for _, key := range tryKeys {
			if b, err := utils.RetrieveFileContentFromMinio(key); err == nil && len(b) > 0 {
				var raw interface{}
				if err := yaml.Unmarshal(b, &raw); err == nil {
					// convert nested maps to string-keyed maps so json.Marshal works later
					conv := convertToStringKeys(raw)
					if fd, ok := conv.(map[string]interface{}); ok {
						challengeData["yaml"] = fd
						log.Printf("Attached YAML from MinIO for slug=%s key=%s", slug, key)
						break
					} else {
						log.Printf("parsed YAML is not a map for %s (type=%T)", key, conv)
					}
				} else {
					log.Printf("failed to parse YAML from MinIO for %s: %v", key, err)
				}
			} else {
				log.Printf("could not retrieve %s from MinIO: %v", key, err)
			}
		}
	}

	body, err := json.Marshal(challengeData)
	if err != nil {
		log.Printf("failed to marshal challengeData for sending: %v", err)
	}
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
