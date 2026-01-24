package controllers

import (
	"encoding/json"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/pwnthemall/pwnthemall/backend/config"
	"github.com/pwnthemall/pwnthemall/backend/debug"
	"github.com/pwnthemall/pwnthemall/backend/dto"
	"github.com/pwnthemall/pwnthemall/backend/models"
	"github.com/pwnthemall/pwnthemall/backend/utils"
)

// messageToTeamChatResponse converts a TeamChatMessage model to TeamChatMessageResponse DTO
func messageToTeamChatResponse(msg models.TeamChatMessage) dto.TeamChatMessageResponse {
	response := dto.TeamChatMessageResponse{
		ID:          msg.ID,
		TeamID:      msg.TeamID,
		UserID:      msg.UserID,
		Message:     msg.Message,
		Attachments: msg.Attachments,
		CreatedAt:   msg.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}

	if msg.User.ID != 0 {
		response.Username = msg.User.Username
	}

	return response
}

// GetTeamChatMessages retrieves paginated team chat messages
func GetTeamChatMessages(c *gin.Context) {
	userID := c.GetUint("user_id")
	teamIDStr := c.Param("id")
	teamID, err := strconv.ParseUint(teamIDStr, 10, 32)
	if err != nil {
		utils.BadRequestError(c, "invalid_team_id")
		return
	}

	// Get user and verify team membership
	var user models.User
	if err := config.DB.First(&user, userID).Error; err != nil {
		utils.InternalServerError(c, "user_not_found")
		return
	}

	// Check if user is in this team
	if user.TeamID == nil || *user.TeamID != uint(teamID) {
		utils.ForbiddenError(c, "not_in_team")
		return
	}

	// Parse pagination parameters
	limit := 50                 // Max 50 messages per page
	cursor := c.Query("cursor") // Message ID to start from

	// Get total message count
	var totalMessages int64
	config.DB.Model(&models.TeamChatMessage{}).Where("team_id = ?", teamID).Count(&totalMessages)

	// Build paginated message query
	messagesQuery := config.DB.
		Model(&models.TeamChatMessage{}).
		Where("team_id = ?", teamID).
		Preload("User").
		Order("id DESC")

	// Apply cursor if provided (for loading older messages)
	if cursor != "" {
		// Validate cursor is a valid uint
		cursorID, err := strconv.ParseUint(cursor, 10, 32)
		if err != nil {
			utils.BadRequestError(c, "invalid_cursor")
			return
		}
		messagesQuery = messagesQuery.Where("id < ?", cursorID)
	}

	// Fetch limit + 1 to check if there are more messages
	var messages []models.TeamChatMessage
	messagesQuery.Limit(limit + 1).Find(&messages)

	// Determine if there are more messages
	hasMore := len(messages) > limit
	var nextCursor *uint
	if hasMore {
		// Remove the extra message used for pagination detection
		messages = messages[:limit]
		lastID := messages[len(messages)-1].ID
		nextCursor = &lastID
	}

	// Convert messages (reverse order to show oldest first in the page)
	messageResponses := make([]dto.TeamChatMessageResponse, len(messages))
	for i := len(messages) - 1; i >= 0; i-- {
		messageResponses[len(messages)-1-i] = messageToTeamChatResponse(messages[i])
	}

	response := gin.H{
		"messages":      messageResponses,
		"hasMore":       hasMore,
		"nextCursor":    nextCursor,
		"totalMessages": totalMessages,
	}

	utils.OKResponse(c, response)
}

// SendTeamChatMessage sends a message in team chat
func SendTeamChatMessage(c *gin.Context) {
	userID := c.GetUint("user_id")
	teamIDStr := c.Param("id")
	teamID, err := strconv.ParseUint(teamIDStr, 10, 32)
	if err != nil {
		utils.BadRequestError(c, "invalid_team_id")
		return
	}

	// Get user and verify team membership
	var user models.User
	if err := config.DB.First(&user, userID).Error; err != nil {
		utils.InternalServerError(c, "user_not_found")
		return
	}

	// Check if user is in this team
	if user.TeamID == nil || *user.TeamID != uint(teamID) {
		utils.ForbiddenError(c, "not_in_team")
		return
	}

	// Parse input
	var input dto.TeamChatMessageInput
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.BadRequestError(c, "invalid_input")
		return
	}

	// Validate attachments (prevent path traversal)
	for _, attachment := range input.Attachments {
		if !utils.IsValidFilename(attachment) {
			utils.BadRequestError(c, "invalid_attachment_path")
			return
		}
	}

	// Sanitize message content to prevent XSS (strict - no HTML allowed)
	sanitizedMessage := utils.SanitizeStrict(input.Message)

	// Create message
	message := models.TeamChatMessage{
		TeamID:      uint(teamID),
		UserID:      userID,
		Message:     sanitizedMessage,
		Attachments: input.Attachments,
	}

	if err := config.DB.Create(&message).Error; err != nil {
		utils.InternalServerError(c, "message_creation_failed")
		return
	}

	// Load user for response
	config.DB.Preload("User").First(&message, message.ID)

	// Send WebSocket notification to team members (excluding sender)
	event := dto.TeamChatWebSocketEvent{
		Event:       "team_message",
		TeamID:      uint(teamID),
		MessageID:   message.ID,
		UserID:      userID,
		Username:    user.Username,
		Message:     sanitizedMessage,
		Attachments: message.Attachments,
		CreatedAt:   message.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
	sendTeamChatWebSocketEvent(event, uint(teamID), userID)

	utils.CreatedResponse(c, messageToTeamChatResponse(message))
}

// sendTeamChatWebSocketEvent sends a team chat event via WebSocket to all team members
func sendTeamChatWebSocketEvent(event dto.TeamChatWebSocketEvent, teamID uint, excludeUserID uint) {
	messageBytes, err := json.Marshal(event)
	if err != nil {
		debug.Log("Failed to marshal team chat WebSocket event: %v", err)
		return
	}

	if utils.UpdatesHub == nil {
		debug.Log("UpdatesHub not initialized, cannot send team chat WebSocket event")
		return
	}

	// Send to all team members except the sender
	utils.UpdatesHub.SendToTeamExcept(teamID, excludeUserID, messageBytes)
}
