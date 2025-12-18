package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/pwnthemall/pwnthemall/backend/controllers"
	"github.com/pwnthemall/pwnthemall/backend/middleware"
)

func RegisterPluginRoutes(router *gin.Engine) {
	plugins := router.Group("/plugins", middleware.AuthRequired(false), middleware.CSRFProtection())
	{
		plugins.GET("", middleware.CheckPolicy("/plugins", "read"), controllers.GetLoadedPlugins)
	}
}
