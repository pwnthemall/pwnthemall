package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/pwnthemall/pwnthemall/backend/controllers"
	"github.com/pwnthemall/pwnthemall/backend/middleware"
)

func RegisterSubmissionRoutes(router *gin.Engine) {
	adminSubmissions := router.Group("/admin/submissions", middleware.AuthRequired(false), middleware.CSRFProtection())
	{
		adminSubmissions.GET("", middleware.CheckPolicy("/admin/submissions", "read"), controllers.GetAllSubmissions)
	}
}
