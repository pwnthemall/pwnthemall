package controllers

import (
	"github.com/gin-gonic/gin"
	"github.com/pwnthemall/pwnthemall/backend/middleware"
	"github.com/pwnthemall/pwnthemall/backend/utils"
)

// GetCSRFToken returns the CSRF token for the current session
func GetCSRFToken(c *gin.Context) {
	token := middleware.GetCSRFToken(c)
	if token == "" {
		utils.InternalServerError(c, "csrf_token_not_available")
		return
	}

	utils.OKResponse(c, gin.H{
		"csrfToken": token,
	})
}
