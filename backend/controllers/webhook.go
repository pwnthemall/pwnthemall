package controllers

import (
	"context"
	"strings"

	"github.com/pwnthemall/pwnthemall/backend/debug"

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
		// Handle challenge sync
		if strings.Contains(key, "/chall.yml") {
			go func() {
				ctx := context.Background()
				if err := utils.SyncChallengesFromMinIO(ctx, key, utils.UpdatesHub); err != nil {
					debug.Log("MinIO challenge sync error: %v", err)
				}
			}()
			utils.OKResponse(c, gin.H{"status": "challenge sync started"})
			return
		}

		// Handle page sync
		if strings.Contains(key, "/page.yml") || strings.Contains(key, "/page.html") {
			go func() {
				ctx := context.Background()
				if err := utils.SyncPagesFromMinIO(ctx, key, utils.UpdatesHub); err != nil {
					debug.Log("MinIO page sync error: %v", err)
				} else {
					// Broadcast page sync event to connected clients
					utils.UpdatesHub.SendToAll([]byte(`{"event":"page","action":"synced"}`))
				}
			}()
			utils.OKResponse(c, gin.H{"status": "page sync started"})
			return
		}
	} else {
		debug.Log("Key not found or not a string")
	}

	utils.OKResponse(c, gin.H{"status": "webhook received"})
}
