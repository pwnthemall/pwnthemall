package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/pwnthemall/pwnthemall/backend/controllers"
	"github.com/pwnthemall/pwnthemall/backend/middleware"
)

func RegisterChallengeRoutes(router *gin.Engine) {
	challenges := router.Group("/challenges")
	{
		challenges.GET("", middleware.AuthRequiredTeamOrAdmin(), middleware.CheckPolicy("/challenges", "read"), controllers.GetChallenges)
		challenges.GET("/:id", middleware.AuthRequiredTeamOrAdmin(), middleware.CheckPolicy("/challenges/:id", "read"), controllers.GetChallenge)
		challenges.GET("/:id/solves", middleware.AuthRequiredTeamOrAdmin(), middleware.CheckPolicy("/challenges/:id/solves", "read"), controllers.GetChallengeSolves)
		challenges.GET("/:id/firstbloods", middleware.AuthRequired(false), middleware.CheckPolicy("/challenges/:id/firstbloods", "read"), controllers.GetChallengeFirstBloods)
		challenges.GET("/category/:category", middleware.AuthRequiredTeamOrAdmin(), middleware.CheckPolicy("/challenges/category/:category", "read"), controllers.GetChallengesByCategoryName)

		challenges.GET("/:id/files", middleware.AuthRequiredTeamOrAdmin(), middleware.CheckPolicy("/challenges/:id/files", "read"), controllers.GetChallengeFiles)
		challenges.GET("/:id/files/:filename", middleware.AuthRequiredTeamOrAdmin(), middleware.CheckPolicy("/challenges/:id/files/:filename", "read"), controllers.DownloadChallengeFile)

		challenges.POST("", middleware.CheckPolicy("/challenges", "write"), controllers.CreateChallenge)
		challenges.POST("/:id/submit", middleware.AuthRequiredTeamOrAdmin(), middleware.CheckPolicy("/challenges/:id/submit", "write"), controllers.SubmitChallenge)
		challenges.POST("/:id/build", middleware.DemoRestriction, middleware.AuthRequiredTeamOrAdmin(), middleware.CheckPolicy("/challenges/:id/build", "write"), controllers.BuildChallengeImage)
		challenges.GET("/:id/instance-status", middleware.DemoRestriction, middleware.AuthRequiredTeamOrAdmin(), middleware.CheckPolicy("/challenges/:id/instance-status", "read"), controllers.GetInstanceStatus)
		challenges.POST("/:id/start", middleware.DemoRestriction, middleware.AuthRequiredTeamOrAdmin(), middleware.CheckPolicy("/challenges/:id/start", "write"), controllers.StartChallengeInstance)
		challenges.POST("/:id/stop", middleware.DemoRestriction, middleware.AuthRequiredTeamOrAdmin(), middleware.CheckPolicy("/challenges/:id/stop", "write"), controllers.StopChallengeInstance)

		challenges.GET("/:id/cover", middleware.AuthRequiredTeamOrAdmin(), middleware.CheckPolicy("/challenges/:id/cover", "read"), controllers.GetChallengeCover)

		// Hint routes
		challenges.POST("/hints/:id/purchase", middleware.AuthRequiredTeamOrAdmin(), middleware.CheckPolicy("/challenges/hints/:id/purchase", "write"), controllers.PurchaseHint)
		// challenges.PUT("/:id", middleware.CheckPolicy("/challenges/:id", "write"), controllers.UpdateUser)
		// challenges.DELETE("/:id", middleware.CheckPolicy("/challenges/:id", "write"), controllers.DeleteUser)

	}

	adminChallenges := router.Group("/admin/challenges")
	{
		// Allow admins access without requiring a team; policy check restricts to admin role
		adminChallenges.GET("", middleware.AuthRequired(false), middleware.CheckPolicy("/admin/challenges", "read"), controllers.GetAllChallengesAdmin)
		adminChallenges.GET("/:id", middleware.AuthRequired(false), middleware.CheckPolicy("/admin/challenges/:id", "read"), controllers.GetChallengeAdmin)
		adminChallenges.GET("/:id/export", middleware.AuthRequired(false), middleware.CheckPolicy("/admin/challenges/:id", "read"), controllers.ExportChallenge)
		adminChallenges.POST("", middleware.AuthRequired(false), middleware.CheckPolicy("/admin/challenges", "write"), controllers.CreateChallengeAdmin)
		adminChallenges.PUT("/:id", middleware.AuthRequired(false), middleware.CheckPolicy("/admin/challenges/:id", "write"), controllers.UpdateChallengeAdmin)
		adminChallenges.PUT("/:id/general", middleware.AuthRequired(false), middleware.CheckPolicy("/admin/challenges/:id", "write"), controllers.UpdateChallengeGeneralAdmin)
		adminChallenges.DELETE("/hints/:hintId", middleware.AuthRequired(false), middleware.CheckPolicy("/admin/challenges/hints/:hintId", "write"), controllers.DeleteHint)
		adminChallenges.POST("/hints/activate-scheduled", middleware.AuthRequired(false), middleware.CheckPolicy("/admin/challenges/hints/activate-scheduled", "write"), controllers.CheckAndActivateHints)
	}
}
