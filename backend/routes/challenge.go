package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/pwnthemall/pwnthemall/backend/controllers"
	"github.com/pwnthemall/pwnthemall/backend/middleware"
)

func RegisterChallengeRoutes(router *gin.Engine) {
	challenges := router.Group("/challenges", middleware.AuthRequiredTeamOrAdmin(), middleware.CSRFProtection())
	{
		challenges.GET("", middleware.CheckPolicy("/challenges", "read"), controllers.GetChallenges)
		challenges.GET("/:id", middleware.CheckPolicy("/challenges/:id", "read"), controllers.GetChallenge)
		challenges.GET("/:id/solves", middleware.CheckPolicy("/challenges/:id/solves", "read"), controllers.GetChallengeSolves)
		challenges.GET("/:id/firstbloods", middleware.CheckPolicy("/challenges/:id/firstbloods", "read"), controllers.GetChallengeFirstBloods)
		challenges.GET("/category/:category", middleware.CheckPolicy("/challenges/category/:category", "read"), controllers.GetChallengesByCategoryName)
		challenges.GET("/:id/files", middleware.CheckPolicy("/challenges/:id/files", "read"), controllers.GetChallengeFiles)
		challenges.GET("/:id/files/:filename", middleware.RateLimit(10), middleware.CheckPolicy("/challenges/:id/files/:filename", "read"), controllers.DownloadChallengeFile)
		challenges.GET("/:id/cover", middleware.CheckPolicy("/challenges/:id/cover", "read"), controllers.GetChallengeCover)
		challenges.GET("/:id/instance-status", middleware.DemoRestriction, middleware.CheckPolicy("/challenges/:id/instance-status", "read"), controllers.GetInstanceStatus)

		challenges.POST("", middleware.CheckPolicy("/challenges", "write"), controllers.CreateChallenge)
		challenges.POST("/:id/submit", middleware.RateLimit(10), middleware.CheckPolicy("/challenges/:id/submit", "write"), controllers.SubmitChallenge)
		challenges.POST("/:id/build", middleware.DemoRestriction, middleware.CheckPolicy("/challenges/:id/build", "write"), controllers.BuildChallengeImage)
		challenges.POST("/:id/start", middleware.DemoRestriction, middleware.CheckPolicy("/challenges/:id/start", "write"), controllers.StartChallengeInstance)
		challenges.POST("/:id/stop", middleware.DemoRestriction, middleware.CheckPolicy("/challenges/:id/stop", "write"), controllers.StopChallengeInstance)

		// Hint routes
		challenges.POST("/hints/:id/purchase", middleware.CheckPolicy("/challenges/hints/:id/purchase", "write"), controllers.PurchaseHint)
	}

	adminChallenges := router.Group("/admin/challenges", middleware.AuthRequired(false), middleware.CSRFProtection())
	{
		// Allow admins access without requiring a team; policy check restricts to admin role
		adminChallenges.GET("", middleware.CheckPolicy("/admin/challenges", "read"), controllers.GetAllChallengesAdmin)
		adminChallenges.GET("/:id", middleware.CheckPolicy("/admin/challenges/:id", "read"), controllers.GetChallengeAdmin)
		adminChallenges.GET("/:id/export", middleware.CheckPolicy("/admin/challenges/:id/export", "read"), controllers.ExportChallenge)
		adminChallenges.POST("", middleware.CheckPolicy("/admin/challenges", "write"), controllers.CreateChallengeAdmin)
		adminChallenges.PUT("/:id", middleware.CheckPolicy("/admin/challenges/:id", "write"), controllers.UpdateChallengeAdmin)
		adminChallenges.PUT("/:id/general", middleware.CheckPolicy("/admin/challenges/:id", "write"), controllers.UpdateChallengeGeneralAdmin)
		adminChallenges.DELETE("/hints/:hintId", middleware.CheckPolicy("/admin/challenges/hints/:hintId", "write"), controllers.DeleteHint)
	}
}
