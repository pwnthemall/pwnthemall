package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/pwnthemall/pwnthemall/backend/controllers"
	"github.com/pwnthemall/pwnthemall/backend/middleware"
)

func RegisterChallengeDifficultyRoutes(router *gin.Engine) {
	difficulties := router.Group("/challenge-difficulties", middleware.AuthRequired(false), middleware.CSRFProtection())
	{
		difficulties.GET("", middleware.CheckPolicy("/challenge-difficulties", "read"), controllers.GetChallengeDifficulties)

		difficulties.POST("", middleware.CheckPolicy("/challenge-difficulties", "write"), controllers.CreateChallengeDifficulty)
		difficulties.PUT("/:id", middleware.CheckPolicy("/challenge-difficulties/:id", "write"), controllers.UpdateChallengeDifficulty)
		difficulties.DELETE("/:id", middleware.CheckPolicy("/challenge-difficulties/:id", "write"), controllers.DeleteChallengeDifficulty)
	}
}
