package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/pwnthemall/pwnthemall/backend/controllers"
	"github.com/pwnthemall/pwnthemall/backend/middleware"
)

func RegisterChallengeCategoryRoutes(router *gin.Engine) {
	challenges := router.Group("/challenge-categories", middleware.AuthRequired(false), middleware.CSRFProtection())
	{
		challenges.GET("", middleware.CheckPolicy("/challenges-categories", "read"), controllers.GetChallengeCategories)
		challenges.GET("/:id", middleware.CheckPolicy("/challenges-categories/:id", "read"), controllers.GetChallengeCategory)
		
		challenges.POST("", middleware.CheckPolicy("/challenge-categories", "write"), controllers.CreateChallengeCategory)
		challenges.PUT("/:id/reorder", middleware.CheckPolicy("/challenge-categories/:id/reorder", "write"), controllers.ReorderChallenges)
		challenges.PUT("/:id", middleware.CheckPolicy("/challenge-categories/:id", "write"), controllers.UpdateChallengeCategory)
		challenges.DELETE("/:id", middleware.CheckPolicy("/challenge-categories/:id", "write"), controllers.DeleteChallengeCategory)
	}
}
