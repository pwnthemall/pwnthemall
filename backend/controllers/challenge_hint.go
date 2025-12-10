package controllers

import (
	"encoding/json"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pwnthemall/pwnthemall/backend/config"
	"github.com/pwnthemall/pwnthemall/backend/dto"
	"github.com/pwnthemall/pwnthemall/backend/models"
	"github.com/pwnthemall/pwnthemall/backend/utils"
)

// PurchaseHint allows a team to purchase a hint for points
func PurchaseHint(c *gin.Context) {
	hintID := c.Param("id")

	userI, exists := c.Get("user")
	if !exists {
		utils.UnauthorizedError(c, "unauthorized")
		return
	}
	user, ok := userI.(*models.User)
	if !ok {
		utils.InternalServerError(c, "user_wrong_type")
		return
	}

	// Check if hint exists first
	var hint models.Hint
	if err := config.DB.First(&hint, hintID).Error; err != nil {
		utils.NotFoundError(c, "hint_not_found")
		return
	}

	// Admin without team: return hint content for free (test mode)
	if user.Role == "admin" && user.TeamID == nil {
		utils.OKResponse(c, gin.H{
			"message":  "hint_revealed",
			"hint":     hint,
			"testMode": true,
		})
		return
	}

	if user.TeamID == nil {
		utils.BadRequestError(c, "no_team")
		return
	}

	// Start transaction
	tx := config.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Check if hint is active (can't purchase inactive hints)
	if !hint.IsActive {
		tx.Rollback()
		utils.BadRequestError(c, "hint_not_active")
		return
	}

	// Check if team already purchased this hint
	var existingPurchase models.HintPurchase
	if err := tx.Where("team_id = ? AND hint_id = ?", *user.TeamID, hint.ID).First(&existingPurchase).Error; err == nil {
		tx.Rollback()
		utils.BadRequestError(c, "hint_already_purchased")
		return
	}

	// Calculate team score with decay
	decayService := utils.NewDecay()
	totalScore, err := calculateTeamScore(*user.TeamID, decayService)
	if err != nil {
		tx.Rollback()
		utils.InternalServerError(c, "failed_to_calculate_score")
		return
	}

	// Get total spent on hints
	var totalSpent int64
	tx.Model(&models.HintPurchase{}).
		Where("team_id = ?", *user.TeamID).
		Select("COALESCE(SUM(cost), 0)").
		Scan(&totalSpent)

	availableScore := totalScore - int(totalSpent)

	// Check if team has enough points
	if availableScore < hint.Cost {
		tx.Rollback()
		c.JSON(400, gin.H{
			"error":     "insufficient_points",
			"required":  hint.Cost,
			"available": availableScore,
		})
		return
	}

	// Create hint purchase record
	purchase := models.HintPurchase{
		TeamID: *user.TeamID,
		HintID: hint.ID,
		UserID: user.ID,
		Cost:   hint.Cost,
	}

	if err := tx.Create(&purchase).Error; err != nil {
		tx.Rollback()
		utils.InternalServerError(c, "failed_to_purchase_hint")
		return
	}

	// Commit transaction
	if err := tx.Commit().Error; err != nil {
		utils.InternalServerError(c, "failed_to_commit_transaction")
		return
	}

	// Broadcast hint purchase to team members via WebSocket
	broadcastHintPurchase(user, hint)

	utils.OKResponse(c, gin.H{
		"message": "hint_purchased",
		"hint":    hint,
		"cost":    hint.Cost,
	})
}

// broadcastHintPurchase sends WebSocket notification for hint purchase
func broadcastHintPurchase(user *models.User, hint models.Hint) {
	if utils.WebSocketHub == nil {
		return
	}

	event := dto.HintPurchaseEvent{
		Event:       EventHintPurchase,
		TeamID:      *user.TeamID,
		ChallengeID: hint.ChallengeID,
		HintID:      hint.ID,
		UserID:      user.ID,
		Username:    user.Username,
		HintTitle:   hint.Title,
		HintContent: hint.Content,
		Cost:        hint.Cost,
		Timestamp:   time.Now().UTC().Unix(),
	}

	if payload, err := json.Marshal(event); err == nil {
		utils.WebSocketHub.SendToTeam(*user.TeamID, payload)
	}
}
