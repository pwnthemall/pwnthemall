package controllers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/pwnthemall/pwnthemall/backend/config"
	"github.com/pwnthemall/pwnthemall/backend/models"
)

// GetChallengeDifficulties returns all challenge difficulties
func GetChallengeDifficulties(c *gin.Context) {
	var difficulties []models.ChallengeDifficulty
	if err := config.DB.Order("id").Find(&difficulties).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, difficulties)
}

// CreateChallengeDifficulty creates a new challenge difficulty
func CreateChallengeDifficulty(c *gin.Context) {
	var input struct {
		Name  string `json:"name" binding:"required"`
		Color string `json:"color" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	difficulty := models.ChallengeDifficulty{
		Name:  input.Name,
		Color: input.Color,
	}

	if err := config.DB.Create(&difficulty).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, difficulty)
}

// UpdateChallengeDifficulty updates an existing challenge difficulty
func UpdateChallengeDifficulty(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var input struct {
		Name  string `json:"name" binding:"required"`
		Color string `json:"color" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var difficulty models.ChallengeDifficulty
	if err := config.DB.First(&difficulty, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Difficulty not found"})
		return
	}

	difficulty.Name = input.Name
	difficulty.Color = input.Color

	if err := config.DB.Save(&difficulty).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, difficulty)
}

// DeleteChallengeDifficulty deletes a challenge difficulty
func DeleteChallengeDifficulty(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var difficulty models.ChallengeDifficulty
	if err := config.DB.First(&difficulty, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Difficulty not found"})
		return
	}

	if err := config.DB.Delete(&difficulty).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Difficulty deleted"})
}
