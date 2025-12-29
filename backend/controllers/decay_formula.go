package controllers

import (
	"github.com/gin-gonic/gin"
	"github.com/pwnthemall/pwnthemall/backend/config"
	"github.com/pwnthemall/pwnthemall/backend/models"
	"github.com/pwnthemall/pwnthemall/backend/utils"
)

func GetDecayFormulas(c *gin.Context) {
	var decayFormulas []models.DecayFormula
	if err := config.DB.Where("name != '' AND name IS NOT NULL").Order("CASE WHEN type = 'fixed' THEN 0 ELSE 1 END, name ASC").Find(&decayFormulas).Error; err != nil {
		utils.InternalServerError(c, err.Error())
		return
	}

	utils.OKResponse(c, decayFormulas)
}

func CreateDecayFormula(c *gin.Context) {
	var decayFormula models.DecayFormula
	if err := c.ShouldBindJSON(&decayFormula); err != nil {
		utils.BadRequestError(c, err.Error())
		return
	}

	// Validate that name is not empty
	if decayFormula.Name == "" {
		utils.BadRequestError(c, "Decay formula name cannot be empty")
		return
	}

	if err := config.DB.Create(&decayFormula).Error; err != nil {
		utils.InternalServerError(c, err.Error())
		return
	}

	utils.CreatedResponse(c, decayFormula)
}

func UpdateDecayFormula(c *gin.Context) {
	var decayFormula models.DecayFormula
	id := c.Param("id")

	if err := config.DB.First(&decayFormula, id).Error; err != nil {
		utils.NotFoundError(c, "Decay formula not found")
		return
	}

	if err := c.ShouldBindJSON(&decayFormula); err != nil {
		utils.BadRequestError(c, err.Error())
		return
	}

	// Validate that name is not empty
	if decayFormula.Name == "" {
		utils.BadRequestError(c, "Decay formula name cannot be empty")
		return
	}

	if err := config.DB.Save(&decayFormula).Error; err != nil {
		utils.InternalServerError(c, err.Error())
		return
	}

	utils.OKResponse(c, decayFormula)
}

func DeleteDecayFormula(c *gin.Context) {
	id := c.Param("id")

	if err := config.DB.Delete(&models.DecayFormula{}, id).Error; err != nil {
		utils.InternalServerError(c, err.Error())
		return
	}

	utils.OKResponse(c, gin.H{"message": "Decay formula deleted successfully"})
}
