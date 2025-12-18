package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/pwnthemall/pwnthemall/backend/controllers"
	"github.com/pwnthemall/pwnthemall/backend/middleware"
)

func RegisterDockerConfigRoutes(router *gin.Engine) {

	configs := router.Group("/docker-config", middleware.DemoRestriction, middleware.AuthRequired(false), middleware.CSRFProtection())
	{
		configs.GET("", middleware.CheckPolicy("/docker-config", "read"), controllers.GetDockerConfig)
		
		configs.PUT("", middleware.CheckPolicy("/docker-config", "write"), controllers.UpdateDockerConfig)
	}
}
