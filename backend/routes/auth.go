package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/pwnthemall/pwnthemall/backend/controllers"
	"github.com/pwnthemall/pwnthemall/backend/middleware"
)

func RegisterAuthRoutes(router *gin.Engine) {
	auth := router.Group("/")
	{
		auth.POST("login", middleware.RateLimitLogin(), middleware.CSRFProtection(), controllers.Login)
		auth.POST("register", middleware.CSRFProtection(), controllers.Register)
		auth.POST("logout", middleware.AuthRequired(false), middleware.CSRFProtection(), controllers.Logout)

		auth.POST("refresh", controllers.Refresh)
		auth.GET("me", middleware.AuthRequired(false), controllers.GetCurrentUser)
		auth.GET("csrf-token", middleware.RateLimit(30), middleware.CSRFProtection(), controllers.GetCSRFToken)
		auth.GET("pwn", middleware.AuthRequired(false), func(c *gin.Context) {
			c.JSON(200, gin.H{"success": "true"})
		})

		auth.PATCH("me", middleware.AuthRequired(false), middleware.CSRFProtection(), controllers.UpdateCurrentUser)
		auth.PUT("me/password", middleware.AuthRequired(false), middleware.CSRFProtection(), controllers.UpdateCurrentUserPassword)
		auth.DELETE("me", middleware.AuthRequired(false), middleware.CSRFProtection(), controllers.DeleteCurrentUser)

		// Password reset routes
		auth.POST("forgot-password", middleware.RateLimit(3), middleware.CSRFProtection(), controllers.ForgotPassword)
		auth.POST("reset-password", middleware.CSRFProtection(), controllers.ResetPassword)
		auth.GET("validate-reset-token/:token", controllers.ValidateResetToken)
	}
}
