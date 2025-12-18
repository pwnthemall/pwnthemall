package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/pwnthemall/pwnthemall/backend/controllers"
	"github.com/pwnthemall/pwnthemall/backend/middleware"
)

func RegisterBadgeRoutes(router *gin.Engine) {
	badges := router.Group("/badges", middleware.AuthRequired(false), middleware.CSRFProtection())
	{
		badges.GET("", middleware.CheckPolicy("/badges", "read"), controllers.GetBadges)
		badges.GET("/:id", middleware.CheckPolicy("/badges/:id", "read"), controllers.GetBadge)

		badges.POST("", middleware.CheckPolicy("/badges", "write"), controllers.CreateBadge)
	}

	users := router.Group("/users", middleware.AuthRequired(false), middleware.CSRFProtection())
	{
		users.GET("/:id/badges", middleware.CheckPolicy("/users/:id/badges", "read"), controllers.GetUserBadges)
	}
}
