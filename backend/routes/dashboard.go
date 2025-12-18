package routes

import (
	"github.com/pwnthemall/pwnthemall/backend/controllers"
	"github.com/pwnthemall/pwnthemall/backend/middleware"

	"github.com/gin-gonic/gin"
)

func RegisterDashboardRoutes(router *gin.Engine) {
	// Admin-only dashboard endpoints
	dashboard := router.Group("/admin/dashboard", middleware.AuthRequired(false), middleware.CSRFProtection())
	{
		dashboard.GET("/stats", middleware.CheckPolicy("/admin/dashboard", "read"), controllers.GetDashboardStats)
		dashboard.GET("/submission-trend", middleware.CheckPolicy("/admin/dashboard", "read"), controllers.GetSubmissionTrend)
		dashboard.GET("/running-instances", middleware.CheckPolicy("/admin/dashboard", "read"), controllers.GetRunningInstances)
	}
}
