package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/pwnthemall/pwnthemall/backend/controllers"
	"github.com/pwnthemall/pwnthemall/backend/middleware"
)

const adminInstancesPath = "/admin/instances"

func RegisterInstanceRoutes(router *gin.Engine) {
	adminInstances := router.Group(adminInstancesPath, middleware.AuthRequired(false), middleware.CSRFProtection())
	{
		adminInstances.GET("", middleware.CheckPolicy(adminInstancesPath, "read"), controllers.GetAllInstancesAdmin)

		adminInstances.DELETE("/:id", middleware.DemoRestriction, middleware.CheckPolicy(adminInstancesPath, "delete"), controllers.DeleteInstanceAdmin)
		adminInstances.DELETE("", middleware.DemoRestriction, middleware.CheckPolicy(adminInstancesPath, "delete"), controllers.StopAllInstancesAdmin)
	}

	challenges := router.Group("/instances", middleware.DemoRestriction, middleware.AuthRequiredTeamOrAdmin(), middleware.CSRFProtection())
	{
		challenges.GET("", middleware.CheckPolicy("/instances", "read"), controllers.GetInstances)
		challenges.GET("/:id", middleware.CheckPolicy("/instances/:id", "read"), controllers.GetInstance)
	}
}
