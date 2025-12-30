package routes

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
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

		if expectedToken == "" {
			debug.Log("WARNING: MINIO_NOTIFY_WEBHOOK_AUTH_TOKEN_DBSYNC not set, webhooks are insecure!")
		}

		if len(parts) != 2 || parts[0] != "Bearer" || parts[1] != expectedToken {
			debug.Log("Webhook auth failed: invalid token")
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			return
		}

		c.Next()
	}
}

// Optional HMAC signature validation (defense-in-depth)
func validateWebhookSignature(c *gin.Context, body []byte) bool {
	signature := c.GetHeader("X-Minio-Signature")
	webhookSecret := os.Getenv("MINIO_WEBHOOK_SECRET")

	// If no secret configured, skip signature validation (rely on Bearer token only)
	if webhookSecret == "" {
		return true
	}

	// If secret is configured, signature must be present and valid
	if signature == "" {
		debug.Log("Webhook signature validation failed: missing X-Minio-Signature header")
		return false
	}

	// Compute HMAC
	mac := hmac.New(sha256.New, []byte(webhookSecret))
	mac.Write(body)
	expectedSignature := hex.EncodeToString(mac.Sum(nil))

	// Constant-time comparison to prevent timing attacks
	if !hmac.Equal([]byte(signature), []byte(expectedSignature)) {
		debug.Log("Webhook signature validation failed: signature mismatch")
		return false
	}

	return true
}

func RegisterWebhookRoutes(router *gin.Engine) {
	auth := router.Group("/webhook")
	{
		auth.POST("minio", tokenAuthMiddleware(), controllers.MinioWebhook)
	}
}
