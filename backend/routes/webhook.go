package routes

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/pwnthemall/pwnthemall/backend/controllers"
	"github.com/pwnthemall/pwnthemall/backend/debug"
)

func tokenAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			debug.Log("Webhook auth failed: missing Authorization header")
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		expectedToken := os.Getenv("MINIO_NOTIFY_WEBHOOK_AUTH_TOKEN_DBSYNC")

		// SECURITY FIX: Fail closed if token not configured
		if expectedToken == "" {
			debug.Log("CRITICAL: MINIO_NOTIFY_WEBHOOK_AUTH_TOKEN_DBSYNC not set - webhooks disabled for security")
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"error": "Webhook authentication not configured"})
			return
		}

		if len(parts) != 2 || parts[0] != "Bearer" || parts[1] != expectedToken {
			debug.Log("Webhook auth failed: invalid token")
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			return
		}

		c.Next()
	}
}

func RegisterWebhookRoutes(router *gin.Engine) {
	auth := router.Group("/webhook")
	{
		auth.POST("minio", tokenAuthMiddleware(), controllers.MinioWebhook)
	}
}
