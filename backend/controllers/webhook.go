package controllers

import (
	"github.com/pwnthemall/pwnthemall/backend/debug"
	"context"
	
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/pwnthemall/pwnthemall/backend/utils"
)

func MinioWebhook(c *gin.Context) {
	var event map[string]interface{}
	if err := c.BindJSON(&event); err != nil {
		utils.BadRequestError(c, "invalid JSON payload")
		return
	}

	if key, ok := event["Key"].(string); ok {
		if strings.Contains(key, "/chall.yml") {
			go func() {
				ctx := context.Background()
				if err := utils.SyncChallengesFromMinIO(ctx, key, utils.UpdatesHub); err != nil {
					debug.Log("MinIO sync error: %v", err)
				}
			}()
		}
	} else {
		debug.Log("Key not found or not a string")
	}

	utils.OKResponse(c, gin.H{"status": "challenge sync started"})
}
