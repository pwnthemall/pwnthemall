package utils

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/pwnthemall/pwnthemall/backend/debug"
)

func ValidateWebhookSignature(c *gin.Context, body []byte) bool {
	signature := c.GetHeader("X-Minio-Signature")
	webhookSecret := os.Getenv("MINIO_WEBHOOK_SECRET")

	if webhookSecret == "" {
		return true
	}

	if signature == "" {
		debug.Log("Webhook signature validation failed: missing X-Minio-Signature header")
		return false
	}

	mac := hmac.New(sha256.New, []byte(webhookSecret))
	mac.Write(body)
	expectedSignature := hex.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(signature), []byte(expectedSignature)) {
		debug.Log("Webhook signature validation failed: signature mismatch")
		return false
	}

	return true
}
