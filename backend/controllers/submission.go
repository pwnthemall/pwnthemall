package controllers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jinzhu/copier"
	"github.com/pwnthemall/pwnthemall/backend/config"
	"github.com/pwnthemall/pwnthemall/backend/dto"
	"github.com/pwnthemall/pwnthemall/backend/models"
)

// GetAllSubmissions returns all submissions with user and challenge info (admin only)
func GetAllSubmissions(c *gin.Context) {
	var submissions []models.Submission

	if err := config.DB.
		Preload("User.Team").
		Preload("Challenge").
		Order("created_at DESC").
		Find(&submissions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch submissions"})
		return
	}

	response := make([]dto.SubmissionResponse, len(submissions))

	for i, s := range submissions {

		value := s.Value
		if s.IsCorrect {
			value = "*********"
		}

		var safeTeam dto.SafeTeam
		if s.User != nil && s.User.Team != nil {
			_ = copier.Copy(&safeTeam, s.User.Team)
		}

		response[i] = dto.SubmissionResponse{
			ID:        s.ID,
			Value:     value,
			IsCorrect: s.IsCorrect,
			CreatedAt: s.CreatedAt,
			User: dto.SafeUserWithTeam{
				ID:       s.UserID,
				Username: s.User.Username,
				Role:     s.User.Role,
				Team:     safeTeam,
			},
			ChallengeID: s.ChallengeID,
			Challenge:   s.Challenge,
		}
	}

	c.JSON(http.StatusOK, response)
}
