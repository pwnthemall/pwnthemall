package controllers

import (
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jinzhu/copier"
	"github.com/pwnthemall/pwnthemall/backend/config"
	"github.com/pwnthemall/pwnthemall/backend/dto"
	"github.com/pwnthemall/pwnthemall/backend/models"
	"github.com/pwnthemall/pwnthemall/backend/utils"
)

// Cache for CTF status
var (
	ctfStatusCache *gin.H
	ctfCacheTime   time.Time
	ctfCacheMutex  sync.RWMutex
)

const ctfCacheDuration = 30 * time.Second

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

	// Validate time format for CTF timing configs
	if err := validateCTFTimeFormat(input.Key, input.Value); err != nil {
		utils.BadRequestError(c, err.Error())
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

	// Validate that end time is after start time
	if cfg.Key == "CTF_START_TIME" || cfg.Key == "CTF_END_TIME" {
		if err := validateCTFTimeOrder(); err != nil {
			// Rollback the change
			config.DB.Delete(&cfg)
			utils.BadRequestError(c, err.Error())
			return
		}
	}

	// Sync environment variables if this is a SyncWithEnv config
	if cfg.SyncWithEnv {
		config.SynchronizeEnvWithDb()
	}

	// Broadcast CTF status update if timing-related config changed
	if cfg.Key == "CTF_START_TIME" || cfg.Key == "CTF_END_TIME" {
		invalidateCTFStatusCache()

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

	// Validate time format for CTF timing configs
	if err := validateCTFTimeFormat(key, input.Value); err != nil {
		utils.BadRequestError(c, err.Error())
		return
	}

	var cfg models.Config

	result := config.DB.Where("key = ?", key).First(&cfg)
	if result.Error != nil {
		utils.NotFoundError(c, "Configuration not found")
		return
	}

	// Store old value for potential rollback
	oldValue := cfg.Value

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

	// Validate that end time is after start time
	if key == "CTF_START_TIME" || key == "CTF_END_TIME" {
		if err := validateCTFTimeOrder(); err != nil {
			// Rollback the change
			cfg.Value = oldValue
			config.DB.Save(&cfg)
			utils.BadRequestError(c, err.Error())
			return
		}
	}

	// Sync environment variables if this is a SyncWithEnv config
	if cfg.SyncWithEnv {
		config.SynchronizeEnvWithDb()
	}

	// Broadcast CTF status update if timing-related config changed
	if key == "CTF_START_TIME" || key == "CTF_END_TIME" {
		invalidateCTFStatusCache()

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

// GetCTFStatus returns the current CTF timing status with caching
func GetCTFStatus(c *gin.Context) {
	// Check cache first
	ctfCacheMutex.RLock()
	if ctfStatusCache != nil && time.Since(ctfCacheTime) < ctfCacheDuration {
		response := *ctfStatusCache
		ctfCacheMutex.RUnlock()
		utils.OKResponse(c, response)
		return
	}
	ctfCacheMutex.RUnlock()

	// Cache miss - fetch fresh data
	status := config.GetCTFStatus()

	var startConfig, endConfig models.Config
	config.DB.Where("key = ?", "CTF_START_TIME").First(&startConfig)
	config.DB.Where("key = ?", "CTF_END_TIME").First(&endConfig)

	response := gin.H{
		"status":     string(status),
		"is_active":  config.IsCTFActive(),
		"is_started": config.IsCTFStarted(),
		"startTime":  startConfig.Value,
		"endTime":    endConfig.Value,
		"serverTime": time.Now().UTC().Format(time.RFC3339),
	}

	// Update cache
	ctfCacheMutex.Lock()
	ctfStatusCache = &response
	ctfCacheTime = time.Now()
	ctfCacheMutex.Unlock()

	utils.OKResponse(c, response)
}

// GetPublicConfigs returns only public configurations
func GetPublicConfigs(c *gin.Context) {
	var configs []models.Config
	result := config.DB.Where("public = ?", true).Find(&configs)
	if result.Error != nil {
		utils.InternalServerError(c, result.Error.Error())
		return
	}
	utils.OKResponse(c, configs)
}

// validateCTFTimeFormat validates RFC3339 format for CTF timing configs
func validateCTFTimeFormat(key, value string) error {
	if key != "CTF_START_TIME" && key != "CTF_END_TIME" {
		return nil
	}

	// Allow empty values (no timing)
	if value == "" {
		return nil
	}

	_, err := time.Parse(time.RFC3339, value)
	if err != nil {
		return fmt.Errorf("invalid time format. expected RFC3339 (e.g., 2025-12-17T18:00:00Z): %v", err)
	}

	return nil
}

// validateCTFTimeOrder ensures end time is after start time
func validateCTFTimeOrder() error {
	var startConfig, endConfig models.Config

	if err := config.DB.Where("key = ?", "CTF_START_TIME").First(&startConfig).Error; err != nil {
		return nil // Start time not set yet
	}

	if err := config.DB.Where("key = ?", "CTF_END_TIME").First(&endConfig).Error; err != nil {
		return nil // End time not set yet
	}

	// If either is empty, no validation needed
	if startConfig.Value == "" || endConfig.Value == "" {
		return nil
	}

	startTime, err := time.Parse(time.RFC3339, startConfig.Value)
	if err != nil {
		return nil // Invalid format will be caught by validateCTFTimeFormat
	}

	endTime, err := time.Parse(time.RFC3339, endConfig.Value)
	if err != nil {
		return nil // Invalid format will be caught by validateCTFTimeFormat
	}

	if !endTime.After(startTime) {
		return fmt.Errorf("CTF end time must be after start time")
	}

	return nil
}

// invalidateCTFStatusCache clears the cached CTF status
func invalidateCTFStatusCache() {
	ctfCacheMutex.Lock()
	ctfStatusCache = nil
	ctfCacheMutex.Unlock()
}
