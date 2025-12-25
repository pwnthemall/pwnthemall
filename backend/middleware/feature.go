package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/pwnthemall/pwnthemall/backend/config"
	"github.com/pwnthemall/pwnthemall/backend/models"
)

// TicketsEnabled checks if the ticket system is enabled
// This should be called BEFORE AuthRequired to block all access (API + page navigation)
func TicketsEnabled(c *gin.Context) {
	var cfg models.Config
	if err := config.DB.Where("key = ?", "TICKETS_ENABLED").First(&cfg).Error; err == nil {
		if cfg.Value == "false" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Ticket system is disabled"})
			return
		}
	}
	c.Next()
}
