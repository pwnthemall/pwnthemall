package controllers

import (
	"errors"
	"fmt"

	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jinzhu/copier"
	"github.com/pwnthemall/pwnthemall/backend/config"
	"github.com/pwnthemall/pwnthemall/backend/models"
	"github.com/pwnthemall/pwnthemall/backend/utils"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// GetTeams returns all teams with their members
func GetTeams(c *gin.Context) {
	var teams []models.Team
	if err := config.DB.Preload("Users").Find(&teams).Error; err != nil {
		utils.InternalServerError(c, "Failed to fetch teams")
		return
	}
	utils.OKResponse(c, teams)
}

// GetTeam returns detailed information about a team including members and points
func GetTeam(c *gin.Context) {
	id := c.Param("id")
	var team models.Team
	if err := config.DB.First(&team, id).Error; err != nil {
		utils.NotFoundError(c, "Team not found")
		return
	}
	var members []models.User
	if err := config.DB.Where("team_id = ?", team.ID).Find(&members).Error; err != nil {
		utils.InternalServerError(c, err.Error())
		return
	}
	// Compute per-member points by attributing each team solve to the user whose submission led to it
	// IMPORTANT: JSON only supports string keys for maps; use string keys to avoid marshal errors
	memberPoints := map[string]int{}
	var totalPoints int

	// Initialize decay service for current points calculation
	decayService := utils.NewDecay()

	// Fetch all solves for this team
	var solves []models.Solve
	if err := config.DB.Where("team_id = ?", team.ID).Order("created_at ASC").Find(&solves).Error; err == nil {
		for _, solve := range solves {
			// Get challenge to calculate current decayed points
			var challenge models.Challenge
			if err := config.DB.Preload("DecayFormula").First(&challenge, solve.ChallengeID).Error; err != nil {
				continue
			}

			// Calculate position and current points with decay
			position := getSolvePosition(challenge.ID, solve.CreatedAt)
			currentPoints := calculateSolvePointsWithDecay(&solve, &challenge, position, decayService)

			// Find the submission that led to this solve: the latest submission for this challenge
			// by a member of the team at or before the solve time
			var submission models.Submission
			subRes := config.DB.
				Where("challenge_id = ? AND user_id IN (SELECT id FROM users WHERE team_id = ?) AND created_at <= ?",
					solve.ChallengeID, team.ID, solve.CreatedAt).
				Order("created_at DESC").
				First(&submission)
			if subRes.Error == nil && submission.UserID != 0 {
				key := fmt.Sprintf("%d", submission.UserID)
				memberPoints[key] += currentPoints
			}
			totalPoints += currentPoints
		}
	}

	// Get total spent on hints
	var totalSpent int64
	config.DB.Model(&models.HintPurchase{}).
		Where("team_id = ?", team.ID).
		Select("COALESCE(SUM(cost), 0)").
		Scan(&totalSpent)

	utils.OKResponse(c, gin.H{
		"team":         team,
		"members":      members,
		"memberPoints": memberPoints,
		"totalPoints":  totalPoints - int(totalSpent),
		"spentOnHints": int(totalSpent),
	})
}

// CreateTeam creates a new team and assigns the current user as creator
func CreateTeam(c *gin.Context) {
	var input struct {
		Name     string `json:"name" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.BadRequestError(c, "invalid_input")
		return
	}

	input.Name = strings.TrimSpace(input.Name)
	if input.Name == "" {
		utils.BadRequestError(c, "team_name_cannot_be_empty")
		return
	}
	if len(input.Password) < 8 {
		utils.BadRequestError(c, "password_too_short")
		return
	}

	// dupe check
	var existingTeam models.Team
	if err := config.DB.Where("name = ?", input.Name).First(&existingTeam).Error; err == nil {
		utils.ConflictError(c, "team_name_already_exists")
		return
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		utils.InternalServerError(c, "database_error")
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		utils.UnauthorizedError(c, "unauthorized")
		return
	}
	var user models.User
	if err := config.DB.First(&user, userID).Error; err != nil {
		utils.NotFoundError(c, "user_not_found")
		return
	}
	if user.TeamID != nil {
		utils.BadRequestError(c, "user_already_in_team")
		return
	}
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		utils.InternalServerError(c, "internal_server_error")
		return
	}
	var team models.Team
	copier.Copy(&team, &input)
	team.Password = string(hashedPassword)
	team.CreatorID = userID.(uint)
	if err := config.DB.Create(&team).Error; err != nil {
		if strings.Contains(err.Error(), "duplicate key") || strings.Contains(err.Error(), "idx_teams_name_deleted") || strings.Contains(err.Error(), "unique constraint") {
			utils.ConflictError(c, "team_name_already_exists")
			return
		}
		utils.InternalServerError(c, "team_creation_failed")
		return
	}
	user.TeamID = &team.ID
	if err := config.DB.Save(&user).Error; err != nil {
		utils.InternalServerError(c, "user_update_failed")
		return
	}
	utils.CreatedResponse(c, gin.H{"team": team})
}

// UpdateTeam is not implemented
func UpdateTeam(c *gin.Context) {
	utils.NotImplementedError(c, "not_implemented")
}

// DeleteTeam is not implemented
func DeleteTeam(c *gin.Context) {
	utils.NotImplementedError(c, "not_implemented")
}
