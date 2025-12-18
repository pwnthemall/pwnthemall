package config

import (
	"os"
	"time"

	"github.com/pwnthemall/pwnthemall/backend/debug"
	"github.com/pwnthemall/pwnthemall/backend/models"
	"gorm.io/gorm"
)

// getEnvWithDefault returns the environment variable value or a default if not set
func GetEnvWithDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// CTFStatus represents the current status of the CTF
type CTFStatus string

const (
	CTFNotStarted CTFStatus = "not_started"
	CTFActive     CTFStatus = "active"
	CTFEnded      CTFStatus = "ended"
	CTFNoTiming   CTFStatus = "no_timing" // When no start/end times are configured
)

// GetCTFStatus returns the current status of the CTF based on start and end times
func GetCTFStatus() CTFStatus {
	var startConfig, endConfig models.Config

	// Get start time - create if missing
	if err := DB.Where("key = ?", "CTF_START_TIME").First(&startConfig).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			// Create missing CTF_START_TIME config
			startConfig = models.Config{
				Key:    "CTF_START_TIME",
				Value:  GetEnvWithDefault("PTA_CTF_START_TIME", ""),
				Public: true,
			}
			if createErr := DB.Create(&startConfig).Error; createErr != nil {
				debug.Log("Failed to create CTF_START_TIME config: %v", createErr)
				return CTFNoTiming
			}
		} else {
			debug.Log("Database error getting CTF_START_TIME: %v", err)
			return CTFNoTiming
		}
	}

	// Get end time - create if missing
	if err := DB.Where("key = ?", "CTF_END_TIME").First(&endConfig).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			// Create missing CTF_END_TIME config
			endConfig = models.Config{
				Key:    "CTF_END_TIME",
				Value:  GetEnvWithDefault("PTA_CTF_END_TIME", ""),
				Public: true,
			}
			if createErr := DB.Create(&endConfig).Error; createErr != nil {
				debug.Log("Failed to create CTF_END_TIME config: %v", createErr)
				return CTFNoTiming
			}
		} else {
			debug.Log("Database error getting CTF_END_TIME: %v", err)
			return CTFNoTiming
		}
	}

	// If either time is empty, no timing is configured
	if startConfig.Value == "" || endConfig.Value == "" {
		return CTFNoTiming
	}

	// Parse times (expecting RFC3339 format: 2006-01-02T15:04:05Z07:00)
	startTime, err := time.Parse(time.RFC3339, startConfig.Value)
	if err != nil {
		debug.Log("Failed to parse CTF start time")
		return CTFNoTiming
	}

	endTime, err := time.Parse(time.RFC3339, endConfig.Value)
	if err != nil {
		debug.Log("Failed to parse CTF end time: %v", err)
		return CTFNoTiming
	}

	now := time.Now()

	if now.Before(startTime) {
		return CTFNotStarted
	} else if now.After(endTime) {
		return CTFEnded
	} else {
		return CTFActive
	}
}

// IsCTFActive returns true if the CTF is currently active
func IsCTFActive() bool {
	status := GetCTFStatus()
	return status == CTFActive || status == CTFNoTiming
}

// IsCTFStarted returns true if the CTF has started (active or ended)
func IsCTFStarted() bool {
	status := GetCTFStatus()
	return status == CTFActive || status == CTFEnded || status == CTFNoTiming
}
