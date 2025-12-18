package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/pwnthemall/pwnthemall/backend/controllers"
	"github.com/pwnthemall/pwnthemall/backend/middleware"
)

func RegisterDecayFormulaRoutes(router *gin.Engine) {
	decayFormulas := router.Group("/decay-formulas", middleware.CSRFProtection())
	{
		decayFormulas.GET("", controllers.GetDecayFormulas)
		
		decayFormulas.POST("", middleware.AuthRequired(true), middleware.CheckPolicy("/api/decay-formulas", "write"), controllers.CreateDecayFormula)
		decayFormulas.PUT("/:id", middleware.AuthRequired(true), middleware.CheckPolicy("/api/decay-formulas/:id", "write"), controllers.UpdateDecayFormula)
		decayFormulas.DELETE("/:id", middleware.AuthRequired(true), middleware.CheckPolicy("/api/decay-formulas/:id", "write"), controllers.DeleteDecayFormula)
	}
}
