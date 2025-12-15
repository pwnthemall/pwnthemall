package controllers

import (
	"encoding/json"

	"github.com/gin-gonic/gin"
	"github.com/jinzhu/copier"
	"github.com/pwnthemall/pwnthemall/backend/config"
	"github.com/pwnthemall/pwnthemall/backend/dto"
	"github.com/pwnthemall/pwnthemall/backend/models"
	"github.com/pwnthemall/pwnthemall/backend/utils"
)

func GetConfigs(c *gin.Context) {
	var configs []models.Config
	result := config.DB.Find(&configs)
	if result.Error != nil {
		utils.InternalServerError(c, result.Error.Error())
		return
	}
	utils.OKResponse(c, configs)
}

func GetConfig(c *gin.Context) {
	var cfg models.Config
	key := c.Param("key")

	result := config.DB.Where("key = ?", key).First(&cfg)
	if result.Error != nil {
		utils.NotFoundError(c, "Configuration not found")
		return
	}
	utils.OKResponse(c, cfg)
}

func CreateConfig(c *gin.Context) {
	var input dto.ConfigInput
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.BadRequestError(c, "Invalid input: "+err.Error())
		return
	}

	var cfg models.Config
	copier.Copy(&cfg, &input)
	// Handle pointer fields manually
	if input.Public != nil {
		cfg.Public = *input.Public
	}
	if input.SyncWithEnv != nil {
		cfg.SyncWithEnv = *input.SyncWithEnv
	}

	if err := config.DB.Save(&cfg).Error; err != nil {
		utils.InternalServerError(c, err.Error())
		return
	}

	// Sync environment variables if this is a SyncWithEnv config
	if cfg.SyncWithEnv {
		config.SynchronizeEnvWithDb()
	}

	// Broadcast CTF status update if timing-related config changed
	if cfg.Key == "CTF_START_TIME" || cfg.Key == "CTF_END_TIME" {
		if utils.UpdatesHub != nil {
			if payload, err := json.Marshal(gin.H{
				"event":  "ctf-status",
				"action": "config_update",
			}); err == nil {
				utils.UpdatesHub.SendToAll(payload)
			}
		}
	}

	utils.OKResponse(c, cfg)
}

func UpdateConfig(c *gin.Context) {
	var input dto.ConfigInput
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.BadRequestError(c, "Invalid input: "+err.Error())
		return
	}

	key := c.Param("key")
	var cfg models.Config

	result := config.DB.Where("key = ?", key).First(&cfg)
	if result.Error != nil {
		utils.NotFoundError(c, "Configuration not found")
		return
	}

	cfg.Value = input.Value
	if input.Public != nil {
		cfg.Public = *input.Public
	}
	if input.SyncWithEnv != nil {
		cfg.SyncWithEnv = *input.SyncWithEnv
	}

	if err := config.DB.Save(&cfg).Error; err != nil {
		utils.InternalServerError(c, err.Error())
		return
	}

	// Sync environment variables if this is a SyncWithEnv config
	if cfg.SyncWithEnv {
		config.SynchronizeEnvWithDb()
	}

	// Broadcast CTF status update if timing-related config changed
	if key == "CTF_START_TIME" || key == "CTF_END_TIME" {
		if utils.UpdatesHub != nil {
			if payload, err := json.Marshal(gin.H{
				"event":  "ctf-status",
				"action": "config_update",
			}); err == nil {
				utils.UpdatesHub.SendToAll(payload)
			}
		}
	}

	utils.OKResponse(c, cfg)
}

func DeleteConfig(c *gin.Context) {
	key := c.Param("key")
	var cfg models.Config

	result := config.DB.Where("key = ?", key).First(&cfg)
	if result.Error != nil {
		utils.NotFoundError(c, "Configuration not found")
		return
	}

	if err := config.DB.Delete(&cfg).Error; err != nil {
		utils.InternalServerError(c, err.Error())
		return
	}

	// Sync environment variables if this was a SyncWithEnv config
	if cfg.SyncWithEnv {
		config.SynchronizeEnvWithDb()
	}

	utils.OKResponse(c, gin.H{"message": "Configuration deleted successfully"})
}

// GetCTFStatus returns the current CTF timing status
func GetCTFStatus(c *gin.Context) {
	status := config.GetCTFStatus()
	utils.OKResponse(c, gin.H{
		"status":     string(status),
		"is_active":  config.IsCTFActive(),
		"is_started": config.IsCTFStarted(),
	})
}

// GetPublicConfigs returns only public configurations
func GetPublicConfigs(c *gin.Context) {
	// Ensure SITE_THEME exists
	config.EnsureSiteTheme()

	var configs []models.Config
	result := config.DB.Where("public = ?", true).Find(&configs)
	if result.Error != nil {
		utils.InternalServerError(c, result.Error.Error())
		return
	}
	utils.OKResponse(c, configs)
}
