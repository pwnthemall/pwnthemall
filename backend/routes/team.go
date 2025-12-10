package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/pwnthemall/pwnthemall/backend/controllers"
	"github.com/pwnthemall/pwnthemall/backend/middleware"
)

// Route path constants
const (
	pathTeams            = "/teams"
	pathTeamsID          = "/teams/:id"
	pathTeamsRecalculate = "/teams/recalculate-points"
	actionRead           = "read"
	actionWrite          = "write"
)

func RegisterTeamRoutes(router *gin.Engine) {
	// Public routes (no auth required, only policy check)
	publicTeams := router.Group(pathTeams)
	{
		publicTeams.GET("/leaderboard", middleware.CheckPolicy("/teams/leaderboard", actionRead), controllers.GetLeaderboard)
		publicTeams.GET("/timeline", middleware.CheckPolicy("/teams/timeline", actionRead), controllers.GetTeamTimeline)
	}

	// Authenticated routes
	teams := router.Group(pathTeams, middleware.AuthRequired(false))
	{
		teams.GET("", middleware.CheckPolicy(pathTeams, actionRead), controllers.GetTeams)
		teams.GET("/:id", middleware.CheckPolicy(pathTeamsID, actionRead), controllers.GetTeam)
		teams.GET("/score", middleware.CheckPolicy("/teams/score", actionRead), controllers.GetTeamScore)
		teams.POST("", middleware.CheckPolicy(pathTeams, actionWrite), controllers.CreateTeam)
		teams.POST("/join", middleware.CheckPolicy("/teams/join", actionWrite), middleware.RateLimitJoinTeam(), controllers.JoinTeam)
		teams.POST("/leave", middleware.CheckPolicy("/teams/leave", actionWrite), controllers.LeaveTeam)
		teams.POST("/transfer-owner", middleware.CheckPolicy("/teams/transfer-owner", actionWrite), controllers.TransferTeamOwnership)
		teams.POST("/disband", middleware.CheckPolicy("/teams/disband", actionWrite), controllers.DisbandTeam)
		teams.POST("/kick", middleware.CheckPolicy("/teams/kick", actionWrite), controllers.KickTeamMember)
		teams.POST("/recalculate-points", middleware.CheckPolicy(pathTeamsRecalculate, actionWrite), controllers.RecalculateTeamPoints)
		teams.PUT("/:id", middleware.CheckPolicy(pathTeamsID, actionWrite), controllers.UpdateTeam)
		teams.DELETE("/:id", middleware.CheckPolicy(pathTeamsID, actionWrite), controllers.DeleteTeam)
	}
}
