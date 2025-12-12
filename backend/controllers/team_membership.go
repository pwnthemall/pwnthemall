package controllers

import (
	"fmt"

	"github.com/pwnthemall/pwnthemall/backend/debug"

	"github.com/gin-gonic/gin"
	"github.com/pwnthemall/pwnthemall/backend/config"
	"github.com/pwnthemall/pwnthemall/backend/models"
	"github.com/pwnthemall/pwnthemall/backend/utils"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// JoinTeam allows a user to join an existing team with password
// validateJoinTeamInput validates the input for joining a team
func validateJoinTeamInput(password string) error {
	if len(password) < 8 {
		return fmt.Errorf("password_too_short")
	}
	return nil
}

// findAndValidateTeam finds a team by ID or name and validates the password
func findAndValidateTeam(tx *gorm.DB, teamID *uint, name, password string) (*models.Team, error) {
	var team models.Team

	if teamID != nil {
		if err := tx.First(&team, *teamID).Error; err != nil {
			return nil, fmt.Errorf("team_not_found")
		}
	} else if name != "" {
		if err := tx.Where("name = ?", name).First(&team).Error; err != nil {
			return nil, fmt.Errorf("team_not_found")
		}
	} else {
		return nil, fmt.Errorf("team_id_or_name_required")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(team.Password), []byte(password)); err != nil {
		return nil, fmt.Errorf("invalid_password")
	}

	return &team, nil
}

// processJoinTeamTransaction handles the database transaction for joining a team
func processJoinTeamTransaction(tx *gorm.DB, userID interface{}, teamID *uint, name, password string) error {
	var user models.User
	if err := tx.First(&user, userID).Error; err != nil {
		return fmt.Errorf("user_not_found")
	}

	if user.TeamID != nil {
		return fmt.Errorf("user_already_in_team")
	}

	team, err := findAndValidateTeam(tx, teamID, name, password)
	if err != nil {
		return err
	}

	user.TeamID = &team.ID
	if err := tx.Save(&user).Error; err != nil {
		return fmt.Errorf("team_join_failed")
	}

	return nil
}

// handleJoinTeamError handles errors from the join team transaction
func handleJoinTeamError(c *gin.Context, err error) {
	switch err.Error() {
	case "user_not_found":
		utils.NotFoundError(c, "user_not_found")
	case "user_already_in_team":
		utils.BadRequestError(c, "user_already_in_team")
	case "team_not_found":
		utils.NotFoundError(c, "team_not_found")
	case "team_id_or_name_required":
		utils.BadRequestError(c, "team_id_or_name_required")
	case "invalid_password":
		utils.UnauthorizedError(c, "invalid_password")
	default:
		utils.InternalServerError(c, "team_join_failed")
	}
}

func JoinTeam(c *gin.Context) {
	var input struct {
		TeamID   *uint  `json:"teamId"`
		Name     string `json:"name"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.BadRequestError(c, "invalid_input")
		return
	}

	// Validate password
	if err := validateJoinTeamInput(input.Password); err != nil {
		utils.BadRequestError(c, err.Error())
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		utils.UnauthorizedError(c, "unauthorized")
		return
	}

	// Process join transaction
	err := config.DB.Transaction(func(tx *gorm.DB) error {
		return processJoinTeamTransaction(tx, userID, input.TeamID, input.Name, input.Password)
	})

	if err != nil {
		handleJoinTeamError(c, err)
		return
	}

	// Load team for response
	var team models.Team
	if input.TeamID != nil {
		config.DB.First(&team, *input.TeamID)
	} else {
		config.DB.Where("name = ?", input.Name).First(&team)
	}

	utils.OKResponse(c, gin.H{"message": "Joined team", "team": team})
}

// LeaveTeam allows a user to leave their current team
func LeaveTeam(c *gin.Context) {
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
	if user.TeamID == nil {
		utils.BadRequestError(c, "user_not_in_team")
		return
	}

	// Store the team ID before removing the user
	teamID := *user.TeamID

	// Remove user from team
	user.TeamID = nil
	if err := config.DB.Save(&user).Error; err != nil {
		utils.InternalServerError(c, "team_leave_failed")
		return
	}

	// Check if there are any remaining members in the team
	var remainingMembers int64
	if err := config.DB.Model(&models.User{}).Where("team_id = ?", teamID).Count(&remainingMembers).Error; err != nil {
		utils.InternalServerError(c, "team_leave_failed")
		return
	}

	// If no members remain, delete the team and all related records
	if remainingMembers == 0 {
		if err := deleteTeamCompletely(teamID); err != nil {
			utils.InternalServerError(c, "team_leave_failed")
			return
		}
	}

	utils.OKResponse(c, gin.H{"message": "Left team"})
}

// TransferTeamOwnership transfers team ownership to another member
func TransferTeamOwnership(c *gin.Context) {
	var input struct {
		TeamID     uint `json:"teamId" binding:"required"`
		NewOwnerID uint `json:"newOwnerId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.BadRequestError(c, "invalid_input")
		return
	}
	userID, exists := c.Get("user_id")
	if !exists {
		utils.UnauthorizedError(c, "unauthorized")
		return
	}
	var team models.Team
	if err := config.DB.First(&team, input.TeamID).Error; err != nil {
		utils.NotFoundError(c, "team_not_found")
		return
	}
	if team.CreatorID != userID.(uint) {
		utils.ForbiddenError(c, "not_team_creator")
		return
	}
	var newOwner models.User
	if err := config.DB.First(&newOwner, input.NewOwnerID).Error; err != nil || newOwner.TeamID == nil || *newOwner.TeamID != team.ID {
		utils.BadRequestError(c, "new_owner_not_in_team")
		return
	}
	team.CreatorID = input.NewOwnerID
	if err := config.DB.Save(&team).Error; err != nil {
		utils.InternalServerError(c, "db_error")
		return
	}
	utils.OKResponse(c, gin.H{"message": "ownership_transferred"})
}

// DisbandTeam removes the team and all its members
func DisbandTeam(c *gin.Context) {
	var input struct {
		TeamID uint `json:"teamId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.BadRequestError(c, "invalid_input")
		return
	}
	userID, exists := c.Get("user_id")
	if !exists {
		utils.UnauthorizedError(c, "unauthorized")
		return
	}
	var team models.Team
	if err := config.DB.First(&team, input.TeamID).Error; err != nil {
		utils.NotFoundError(c, "team_not_found")
		return
	}
	if team.CreatorID != userID.(uint) {
		utils.ForbiddenError(c, "not_team_creator")
		return
	}
	if err := config.DB.Model(&models.User{}).Where("team_id = ?", team.ID).Update("team_id", nil).Error; err != nil {
		utils.InternalServerError(c, "db_error")
		return
	}
	if err := deleteTeamCompletely(team.ID); err != nil {
		utils.InternalServerError(c, "db_error")
		return
	}
	utils.OKResponse(c, gin.H{"message": "team_disbanded"})
}

// KickTeamMember kicks a member from the team (creator only)
func KickTeamMember(c *gin.Context) {
	var input struct {
		TeamID uint `json:"teamId" binding:"required"`
		UserID uint `json:"userId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.BadRequestError(c, "invalid_input")
		return
	}
	userID, exists := c.Get("user_id")
	if !exists {
		utils.UnauthorizedError(c, "unauthorized")
		return
	}
	var team models.Team
	if err := config.DB.First(&team, input.TeamID).Error; err != nil {
		utils.NotFoundError(c, "team_not_found")
		return
	}
	if team.CreatorID != userID.(uint) {
		utils.ForbiddenError(c, "not_team_creator")
		return
	}
	if input.UserID == team.CreatorID {
		utils.BadRequestError(c, "cannot_kick_creator")
		return
	}
	var member models.User
	if err := config.DB.First(&member, input.UserID).Error; err != nil {
		utils.NotFoundError(c, "user_not_found")
		return
	}
	if member.TeamID == nil || *member.TeamID != team.ID {
		utils.BadRequestError(c, "user_not_in_team")
		return
	}
	member.TeamID = nil
	if err := config.DB.Save(&member).Error; err != nil {
		utils.InternalServerError(c, "db_error")
		return
	}
	utils.OKResponse(c, gin.H{"message": "kicked"})
}

// deleteTeamCompletely removes a team and all its related records
func deleteTeamCompletely(teamID uint) error {
	return config.DB.Transaction(func(tx *gorm.DB) error {
		var userIds []uint
		if err := tx.Model(&models.User{}).Where("team_id = ?", teamID).Pluck("id", &userIds).Error; err != nil {
			debug.Log("Failed to get user IDs for team %d: %v", teamID, err)
			return err
		}

		if len(userIds) > 0 {
			if err := tx.Where("user_id IN ?", userIds).Delete(&models.Submission{}).Error; err != nil {
				debug.Log("Failed to delete submissions for team %d: %v", teamID, err)
				return err
			}
		}

		if err := tx.Where("team_id = ?", teamID).Delete(&models.Instance{}).Error; err != nil {
			debug.Log("Failed to delete instances for team %d: %v", teamID, err)
			return err
		}

		if err := tx.Where("team_id = ?", teamID).Delete(&models.DynamicFlag{}).Error; err != nil {
			debug.Log("Failed to delete dynamic flags for team %d: %v", teamID, err)
			return err
		}

		if err := tx.Where("team_id = ?", teamID).Delete(&models.Solve{}).Error; err != nil {
			debug.Log("Failed to delete solves for team %d: %v", teamID, err)
			return err
		}

		if err := tx.Where("team_id = ?", teamID).Delete(&models.HintPurchase{}).Error; err != nil {
			debug.Log("Failed to delete hint purchases for team %d: %v", teamID, err)
			return err
		}

		if err := tx.Delete(&models.Team{}, teamID).Error; err != nil {
			debug.Log("Failed to delete team %d: %v", teamID, err)
			return err
		}

		debug.Log("Successfully deleted team %d and all related records", teamID)
		return nil
	})
}
