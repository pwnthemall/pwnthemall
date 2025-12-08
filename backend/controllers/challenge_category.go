package controllers

import (
	"encoding/json"

	"github.com/gin-gonic/gin"
	"github.com/jinzhu/copier"
	"github.com/pwnthemall/pwnthemall/backend/config"
	"github.com/pwnthemall/pwnthemall/backend/dto"
	"github.com/pwnthemall/pwnthemall/backend/models"
	"github.com/pwnthemall/pwnthemall/backend/utils"
)

func GetChallengeCategories(c *gin.Context) {
	user, ok := utils.GetAuthenticatedUser(c)
	if !ok {
		utils.UnauthorizedError(c, "unauthorized")
		return
	}

	if !config.IsCTFStarted() && user.Role != "admin" {
		utils.OKResponse(c, []interface{}{})
		return
	}

	var challengeCategories []models.ChallengeCategory
	result := config.DB.Find(&challengeCategories)
	if result.Error != nil {
		utils.InternalServerError(c, result.Error.Error())
		return
	}
	var safeChallengeCategories []dto.ChallengeCategory
	copier.Copy(&safeChallengeCategories, &challengeCategories)
	utils.OKResponse(c, safeChallengeCategories)
}

func GetChallengeCategory(c *gin.Context) {
	var challengeCategory models.ChallengeCategory
	id := c.Param("id")

	result := config.DB.First(&challengeCategory, id)
	if result.Error != nil {
		utils.NotFoundError(c, "Challenge category not found")
		return
	}
	var safeChallengeCategory dto.ChallengeCategory
	copier.Copy(&safeChallengeCategory, &challengeCategory)
	utils.OKResponse(c, safeChallengeCategory)
}

func CreateChallengeCategory(c *gin.Context) {
	var input dto.ChallengeCategoryInput
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.BadRequestError(c, err.Error())
		return
	}

	var challengeCategory models.ChallengeCategory
	copier.Copy(&challengeCategory, &input)

	if err := config.DB.Create(&challengeCategory).Error; err != nil {
		utils.InternalServerError(c, err.Error())
		return
	}

	// Broadcast category update to all connected clients
	if utils.UpdatesHub != nil {
		if payload, err := json.Marshal(gin.H{
			"event":  "challenge-category",
			"action": "create",
		}); err == nil {
			utils.UpdatesHub.SendToAll(payload)
		}
	}

	utils.CreatedResponse(c, gin.H{
		"id":   challengeCategory.ID,
		"name": challengeCategory.Name,
	})

}

func UpdateChallengeCategory(c *gin.Context) {
	var challengeCategory models.ChallengeCategory
	id := c.Param("id")

	if err := config.DB.First(&challengeCategory, id).Error; err != nil {
		utils.NotFoundError(c, "Challenge category not found")
		return
	}

	var input models.ChallengeCategory
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.BadRequestError(c, err.Error())
		return
	}

	challengeCategory.Name = input.Name
	config.DB.Save(&challengeCategory)

	// Broadcast category update to all connected clients
	if utils.UpdatesHub != nil {
		if payload, err := json.Marshal(gin.H{
			"event":  "challenge-category",
			"action": "update",
		}); err == nil {
			utils.UpdatesHub.SendToAll(payload)
		}
	}
	var safeChallengeCategory dto.ChallengeCategory
	copier.Copy(&safeChallengeCategory, &challengeCategory)
	utils.OKResponse(c, safeChallengeCategory)
}

func DeleteChallengeCategory(c *gin.Context) {
	var challengeCategory models.ChallengeCategory
	id := c.Param("id")

	if err := config.DB.First(&challengeCategory, id).Error; err != nil {
		utils.NotFoundError(c, "Challenge category not found")
		return
	}

	config.DB.Delete(&challengeCategory)

	// Broadcast category update to all connected clients
	if utils.UpdatesHub != nil {
		if payload, err := json.Marshal(gin.H{
			"event":  "challenge-category",
			"action": "delete",
		}); err == nil {
			utils.UpdatesHub.SendToAll(payload)
		}
	}

	utils.OKResponse(c, gin.H{"message": "challenge_category_deleted"})
}

func ReorderChallenges(c *gin.Context) {
	categoryId := c.Param("id")

	var category models.ChallengeCategory
	if err := config.DB.First(&category, categoryId).Error; err != nil {
		utils.NotFoundError(c, "Challenge_category_not_found")
		return
	}

	var req dto.ReorderChallengesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequestError(c, err.Error())
		return
	}

	for index, challengeId := range req.ChallengeIDs {
		var challenge models.Challenge
		if err := config.DB.First(&challenge, challengeId).Error; err != nil {
			continue
		}

		if challenge.ChallengeCategoryID != category.ID {
			utils.BadRequestError(c, "Challenge does not belong to this category")
			return
		}

		challenge.Order = index
		if err := config.DB.Save(&challenge).Error; err != nil {
			utils.InternalServerError(c, "Failed to update challenge order")
			return
		}
	}

	utils.OKResponse(c, gin.H{"message": "challenges_reordered_successfully"})
}
