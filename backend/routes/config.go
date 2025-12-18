package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/pwnthemall/pwnthemall/backend/controllers"
	"github.com/pwnthemall/pwnthemall/backend/middleware"
)

func RegisterConfigRoutes(router *gin.Engine) {
	// Public endpoint for public configurations
	router.GET("/public-configs", controllers.GetPublicConfigs)

	// Public endpoint for CTF status with rate limiting (30 requests per minute)
	router.GET("/ctf-status", middleware.RateLimit(30), controllers.GetCTFStatus)

	configs := router.Group("/configs", middleware.AuthRequired(false), middleware.CSRFProtection())
	{
		configs.GET("", middleware.CheckPolicy("/configs", "read"), controllers.GetConfigs)
		configs.GET("/:key", middleware.DemoRestriction, middleware.CheckPolicy("/configs/:key", "read"), controllers.GetConfig)

		configs.POST("", middleware.DemoRestriction, middleware.CheckPolicy("/configs", "write"), controllers.CreateConfig)
		configs.PUT("/:key", middleware.DemoRestriction, middleware.CheckPolicy("/configs/:key", "write"), controllers.UpdateConfig)
		configs.DELETE("/:key", middleware.DemoRestriction, middleware.CheckPolicy("/configs/:key", "write"), controllers.DeleteConfig)
	}
}
