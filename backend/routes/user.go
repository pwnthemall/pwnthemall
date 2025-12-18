package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/pwnthemall/pwnthemall/backend/controllers"
	"github.com/pwnthemall/pwnthemall/backend/middleware"
)

func RegisterUserRoutes(router *gin.Engine) {
	// Public routes (no auth required, only policy check)
	publicUsers := router.Group("/users")
	{
		publicUsers.GET("/leaderboard", middleware.CheckPolicy("/users/leaderboard", "read"), controllers.GetIndividualLeaderboard)
		publicUsers.GET("/timeline", middleware.CheckPolicy("/users/timeline", "read"), controllers.GetIndividualTimeline)
	}

	users := router.Group("/users", middleware.AuthRequired(false), middleware.CSRFProtection())
	{
		users.GET("", middleware.CheckPolicy("/users", "read"), controllers.GetUsers)
		users.GET("/search/ip", middleware.DemoRestriction, middleware.CheckPolicy("/users", "read"), controllers.GetUserByIP)
		users.GET("/:id", middleware.CheckPolicy("/users/:id", "read"), controllers.GetUser)
		users.GET("/:id/profile", middleware.CheckPolicy("/users/:id/profile", "read"), controllers.GetPublicUserProfile)

		users.POST("", middleware.CheckPolicy("/users", "write"), controllers.CreateUser)
		users.PUT("/:id", middleware.CheckPolicy("/users/:id", "write"), controllers.UpdateUser)
		users.DELETE("/:id", middleware.CheckPolicy("/users/:id", "write"), controllers.DeleteUser)
		users.POST("/:id/ban", middleware.CheckPolicy("/users/:id/ban", "write"), controllers.BanOrUnbanUser)
	}
}
