package controllers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"path/filepath"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/minio/minio-go/v7"
	"github.com/pwnthemall/pwnthemall/backend/config"
	"github.com/pwnthemall/pwnthemall/backend/debug"
	"github.com/pwnthemall/pwnthemall/backend/dto"
	"github.com/pwnthemall/pwnthemall/backend/models"
	"github.com/pwnthemall/pwnthemall/backend/utils"
	"gorm.io/gorm"
)

// ticketToResponse converts a Ticket model to TicketResponse DTO
func ticketToResponse(ticket models.Ticket) dto.TicketResponse {
	response := dto.TicketResponse{
		ID:          ticket.ID,
		Subject:     ticket.Subject,
		Description: ticket.Description,
		Status:      string(ticket.Status),
		TicketType:  string(ticket.TicketType),
		UserID:      ticket.UserID,
		TeamID:      ticket.TeamID,
		ChallengeID: ticket.ChallengeID,
		ClaimedByID: ticket.ClaimedByID,
		Attachments: ticket.Attachments,
		CreatedAt:   ticket.CreatedAt,
		UpdatedAt:   ticket.UpdatedAt,
		ClaimedAt:   ticket.ClaimedAt,
		ResolvedAt:  ticket.ResolvedAt,
	}

	// Set username if user is loaded
	if ticket.User.ID != 0 {
		response.Username = ticket.User.Username
	}

	// Set team name if team is loaded
	if ticket.TeamID != nil && ticket.Team.ID != 0 {
		response.TeamName = &ticket.Team.Name
	}

	// Set challenge info if challenge is loaded
	if ticket.ChallengeID != nil && ticket.Challenge.ID != 0 {
		response.ChallengeName = &ticket.Challenge.Name
		response.ChallengeSlug = &ticket.Challenge.Slug
	}

	// Set claimed by name if loaded
	if ticket.ClaimedByID != nil && ticket.ClaimedBy.ID != 0 {
		response.ClaimedByName = &ticket.ClaimedBy.Username
	}

	// Set message count
	response.MessageCount = len(ticket.Messages)

	// Set last message preview if messages exist
	if len(ticket.Messages) > 0 {
		lastMsg := ticket.Messages[len(ticket.Messages)-1].Message
		if len(lastMsg) > 100 {
			lastMsg = lastMsg[:100] + "..."
		}
		response.LastMessage = &lastMsg
	}

	return response
}

// messageToResponse converts a TicketMessage model to TicketMessageResponse DTO
func messageToResponse(msg models.TicketMessage) dto.TicketMessageResponse {
	response := dto.TicketMessageResponse{
		ID:          msg.ID,
		TicketID:    msg.TicketID,
		UserID:      msg.UserID,
		Message:     msg.Message,
		IsAdmin:     msg.IsAdmin,
		Attachments: msg.Attachments,
		CreatedAt:   msg.CreatedAt,
	}

	if msg.User.ID != 0 {
		response.Username = msg.User.Username
	}

	return response
}

// sendTicketWebSocketEvent sends a ticket event via WebSocket
func sendTicketWebSocketEvent(event dto.TicketWebSocketEvent, targetUserID *uint, targetTeamID *uint, excludeUserID uint) {
	messageBytes, err := json.Marshal(event)
	if err != nil {
		debug.Log("Failed to marshal ticket WebSocket event: %v", err)
		return
	}

	// Use UpdatesHub for real-time ticket updates (not WebSocketHub which is for notifications)
	if utils.UpdatesHub == nil {
		debug.Log("UpdatesHub not initialized, cannot send ticket WebSocket event")
		return
	}

	// Always broadcast to all users (including admins) so everyone sees updates
	// Frontend will filter based on relevance
	debug.Log("Broadcasting ticket WebSocket event: %s for ticket %d to all users (excluding %d)", event.Event, event.TicketID, excludeUserID)
	utils.UpdatesHub.SendToAllExcept(messageBytes, excludeUserID)
}

// ============================================================================
// USER ENDPOINTS
// ============================================================================

// CreateTicket creates a new support ticket
func CreateTicket(c *gin.Context) {
	userID := c.GetUint("user_id")

	var input dto.TicketInput
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.BadRequestError(c, "invalid_input")
		return
	}

	// Get user info
	var user models.User
	if err := config.DB.First(&user, userID).Error; err != nil {
		utils.InternalServerError(c, "user_not_found")
		return
	}

	// Validate team ticket
	if input.TicketType == "team" {
		if user.TeamID == nil {
			utils.BadRequestError(c, "user_not_in_team")
			return
		}
		// Use user's team ID for team tickets
		input.TeamID = user.TeamID
	}

	// Create ticket
	ticket := models.Ticket{
		Subject:     input.Subject,
		Description: input.Description,
		Status:      models.TicketStatusOpen,
		TicketType:  models.TicketType(input.TicketType),
		UserID:      userID,
		TeamID:      input.TeamID,
		ChallengeID: input.ChallengeID,
		Attachments: input.Attachments,
	}

	if err := config.DB.Create(&ticket).Error; err != nil {
		debug.Log("Failed to create ticket: %v", err)
		utils.InternalServerError(c, "ticket_creation_failed")
		return
	}

	// Load relations for response
	config.DB.Preload("User").Preload("Team").Preload("Challenge").First(&ticket, ticket.ID)

	// Send WebSocket notification to admins
	event := dto.TicketWebSocketEvent{
		Event:    "ticket_created",
		TicketID: ticket.ID,
		Subject:  ticket.Subject,
		UserID:   userID,
		Username: user.Username,
		TeamID:   ticket.TeamID,
	}
	sendTicketWebSocketEvent(event, nil, nil, userID)

	utils.CreatedResponse(c, ticketToResponse(ticket))
}

// GetUserTickets retrieves tickets for the current user
func GetUserTickets(c *gin.Context) {
	userID := c.GetUint("user_id")

	// Get user to check team
	var user models.User
	if err := config.DB.First(&user, userID).Error; err != nil {
		utils.InternalServerError(c, "user_not_found")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	query := config.DB.Model(&models.Ticket{}).Where("user_id = ?", userID)

	// Count total
	var total int64
	query.Count(&total)

	// Fetch tickets
	var tickets []models.Ticket
	offset := (page - 1) * pageSize
	result := query.
		Preload("User").
		Preload("Team").
		Preload("Challenge").
		Preload("ClaimedBy").
		Preload("Messages").
		Order("created_at DESC").
		Offset(offset).
		Limit(pageSize).
		Find(&tickets)

	if result.Error != nil {
		utils.InternalServerError(c, "failed_to_fetch_tickets")
		return
	}

	// Convert to response
	ticketResponses := make([]dto.TicketResponse, len(tickets))
	for i, ticket := range tickets {
		ticketResponses[i] = ticketToResponse(ticket)
	}

	totalPages := int(total) / pageSize
	if int(total)%pageSize > 0 {
		totalPages++
	}

	utils.OKResponse(c, dto.TicketListResponse{
		Tickets:    ticketResponses,
		Total:      total,
		Page:       page,
		PageSize:   pageSize,
		TotalPages: totalPages,
	})
}

// GetTicket retrieves a specific ticket with messages
func GetTicket(c *gin.Context) {
	userID := c.GetUint("user_id")
	ticketID := c.Param("id")

	// Get user to check team
	var user models.User
	if err := config.DB.First(&user, userID).Error; err != nil {
		utils.InternalServerError(c, "user_not_found")
		return
	}

	var ticket models.Ticket
	result := config.DB.
		Preload("User").
		Preload("Team").
		Preload("Challenge").
		Preload("ClaimedBy").
		Preload("Messages", func(db *gorm.DB) *gorm.DB {
			return db.Order("created_at ASC").Preload("User")
		}).
		First(&ticket, ticketID)

	if result.Error != nil {
		utils.NotFoundError(c, "ticket_not_found")
		return
	}

	// Check access: user must be the creator or part of the team
	hasAccess := ticket.UserID == userID
	if user.TeamID != nil && ticket.TeamID != nil && *user.TeamID == *ticket.TeamID {
		hasAccess = true
	}

	if !hasAccess {
		utils.ForbiddenError(c, "access_denied")
		return
	}

	// Convert messages
	messages := make([]dto.TicketMessageResponse, len(ticket.Messages))
	for i, msg := range ticket.Messages {
		messages[i] = messageToResponse(msg)
	}

	response := dto.TicketDetailResponse{
		TicketResponse: ticketToResponse(ticket),
		Messages:       messages,
	}

	utils.OKResponse(c, response)
}

// SendTicketMessage sends a message in a ticket
func SendTicketMessage(c *gin.Context) {
	userID := c.GetUint("user_id")
	ticketID := c.Param("id")

	// Get user
	var user models.User
	if err := config.DB.First(&user, userID).Error; err != nil {
		utils.InternalServerError(c, "user_not_found")
		return
	}

	var input dto.TicketMessageInput
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.BadRequestError(c, "invalid_input")
		return
	}

	// Get ticket
	var ticket models.Ticket
	if err := config.DB.First(&ticket, ticketID).Error; err != nil {
		utils.NotFoundError(c, "ticket_not_found")
		return
	}

	// Check access
	hasAccess := ticket.UserID == userID
	if user.TeamID != nil && ticket.TeamID != nil && *user.TeamID == *ticket.TeamID {
		hasAccess = true
	}

	if !hasAccess {
		utils.ForbiddenError(c, "access_denied")
		return
	}

	// Check ticket is not resolved
	if ticket.Status == models.TicketStatusResolved {
		utils.BadRequestError(c, "ticket_already_resolved")
		return
	}

	// Create message
	message := models.TicketMessage{
		TicketID:    ticket.ID,
		UserID:      userID,
		Message:     input.Message,
		IsAdmin:     false,
		Attachments: input.Attachments,
	}

	if err := config.DB.Create(&message).Error; err != nil {
		utils.InternalServerError(c, "message_creation_failed")
		return
	}

	// Update ticket updated_at
	config.DB.Model(&ticket).Update("updated_at", time.Now())

	// Load user for response
	config.DB.Preload("User").First(&message, message.ID)

	// Send WebSocket notification to admins
	event := dto.TicketWebSocketEvent{
		Event:       "ticket_message",
		TicketID:    ticket.ID,
		MessageID:   message.ID,
		UserID:      userID,
		Username:    user.Username,
		Message:     input.Message,
		Attachments: message.Attachments,
		CreatedAt:   message.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		IsAdmin:     false,
	}
	sendTicketWebSocketEvent(event, nil, nil, userID)

	utils.CreatedResponse(c, messageToResponse(message))
}

// CloseTicket allows a user to close their own ticket
func CloseTicket(c *gin.Context) {
	userID := c.GetUint("user_id")
	ticketID := c.Param("id")

	var ticket models.Ticket
	if err := config.DB.First(&ticket, ticketID).Error; err != nil {
		utils.NotFoundError(c, "ticket_not_found")
		return
	}

	// Only the creator can close
	if ticket.UserID != userID {
		utils.ForbiddenError(c, "access_denied")
		return
	}

	now := time.Now()
	ticket.Status = models.TicketStatusResolved
	ticket.ResolvedAt = &now

	if err := config.DB.Save(&ticket).Error; err != nil {
		utils.InternalServerError(c, "failed_to_close_ticket")
		return
	}

	// Send WebSocket notification to all (including the user who closed it, so their UI updates)
	event := dto.TicketWebSocketEvent{
		Event:    "ticket_resolved",
		TicketID: ticket.ID,
		UserID:   userID,
	}
	// Send to the user who owns the ticket (so their detail page refreshes)
	sendTicketWebSocketEvent(event, &ticket.UserID, ticket.TeamID, 0)
	// Also broadcast to admins
	sendTicketWebSocketEvent(event, nil, nil, userID)

	utils.OKResponse(c, gin.H{"message": "ticket_closed"})
}

// UploadTicketAttachment handles file upload for tickets
func UploadTicketAttachment(c *gin.Context) {
	userID := c.GetUint("user_id")

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		utils.BadRequestError(c, "file_required")
		return
	}
	defer file.Close()

	// Validate file type
	allowedTypes := map[string]bool{
		"image/jpeg": true,
		"image/png":  true,
		"image/gif":  true,
		"image/webp": true,
	}

	contentType := header.Header.Get("Content-Type")
	if !allowedTypes[contentType] {
		utils.BadRequestError(c, "invalid_file_type")
		return
	}

	// Validate file size (max 10MB)
	if header.Size > 10*1024*1024 {
		utils.BadRequestError(c, "file_too_large")
		return
	}

	// Generate unique filename
	ext := filepath.Ext(header.Filename)
	filename := fmt.Sprintf("%d_%d%s", userID, time.Now().UnixNano(), ext)
	objectPath := fmt.Sprintf("attachments/%s", filename)

	// Ensure bucket exists
	bucketName := "tickets"
	exists, err := config.FS.BucketExists(context.Background(), bucketName)
	if err != nil {
		debug.Log("Failed to check bucket existence: %v", err)
		utils.InternalServerError(c, "upload_failed")
		return
	}
	if !exists {
		if err := config.FS.MakeBucket(context.Background(), bucketName, minio.MakeBucketOptions{}); err != nil {
			debug.Log("Failed to create bucket: %v", err)
			utils.InternalServerError(c, "upload_failed")
			return
		}
	}

	// Upload to MinIO
	_, err = config.FS.PutObject(
		context.Background(),
		bucketName,
		objectPath,
		file,
		header.Size,
		minio.PutObjectOptions{ContentType: contentType},
	)
	if err != nil {
		debug.Log("Failed to upload file to MinIO: %v", err)
		utils.InternalServerError(c, "upload_failed")
		return
	}

	utils.OKResponse(c, gin.H{"path": objectPath})
}

// GetTicketAttachment serves a ticket attachment
func GetTicketAttachment(c *gin.Context) {
	userID := c.GetUint("user_id")
	ticketID := c.Param("id")
	filename := c.Param("filename")

	// Get user
	var user models.User
	if err := config.DB.First(&user, userID).Error; err != nil {
		utils.InternalServerError(c, "user_not_found")
		return
	}

	// Get ticket to verify access
	var ticket models.Ticket
	if err := config.DB.First(&ticket, ticketID).Error; err != nil {
		utils.NotFoundError(c, "ticket_not_found")
		return
	}

	// Check access
	hasAccess := ticket.UserID == userID || user.Role == "admin"
	if user.TeamID != nil && ticket.TeamID != nil && *user.TeamID == *ticket.TeamID {
		hasAccess = true
	}

	if !hasAccess {
		utils.ForbiddenError(c, "access_denied")
		return
	}

	// Get file from MinIO
	objectPath := fmt.Sprintf("attachments/%s", filename)
	object, err := config.FS.GetObject(context.Background(), "tickets", objectPath, minio.GetObjectOptions{})
	if err != nil {
		utils.NotFoundError(c, "file_not_found")
		return
	}
	defer object.Close()

	objInfo, err := object.Stat()
	if err != nil {
		utils.NotFoundError(c, "file_not_found")
		return
	}

	c.Header("Content-Type", objInfo.ContentType)
	c.Header("Content-Length", fmt.Sprintf("%d", objInfo.Size))
	c.DataFromReader(http.StatusOK, objInfo.Size, objInfo.ContentType, object, nil)
}

// ============================================================================
// ADMIN ENDPOINTS
// ============================================================================

// GetAllTickets retrieves all tickets for admins
func GetAllTickets(c *gin.Context) {
	// Parse query params
	status := c.Query("status")
	ticketType := c.Query("ticketType")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	query := config.DB.Model(&models.Ticket{})

	// Filter by status
	if status != "" {
		query = query.Where("status = ?", status)
	}

	// Filter by ticket type
	if ticketType != "" {
		query = query.Where("ticket_type = ?", ticketType)
	}

	// Count total
	var total int64
	query.Count(&total)

	// Fetch tickets
	var tickets []models.Ticket
	offset := (page - 1) * pageSize
	result := query.
		Preload("User").
		Preload("Team").
		Preload("Challenge").
		Preload("ClaimedBy").
		Preload("Messages").
		Order("created_at DESC").
		Offset(offset).
		Limit(pageSize).
		Find(&tickets)

	if result.Error != nil {
		utils.InternalServerError(c, "failed_to_fetch_tickets")
		return
	}

	// Convert to response
	ticketResponses := make([]dto.TicketResponse, len(tickets))
	for i, ticket := range tickets {
		ticketResponses[i] = ticketToResponse(ticket)
	}

	totalPages := int(total) / pageSize
	if int(total)%pageSize > 0 {
		totalPages++
	}

	utils.OKResponse(c, dto.TicketListResponse{
		Tickets:    ticketResponses,
		Total:      total,
		Page:       page,
		PageSize:   pageSize,
		TotalPages: totalPages,
	})
}

// GetAdminTicket retrieves a specific ticket for admin
func GetAdminTicket(c *gin.Context) {
	ticketID := c.Param("id")

	var ticket models.Ticket
	result := config.DB.
		Preload("User").
		Preload("Team").
		Preload("Challenge").
		Preload("ClaimedBy").
		Preload("Messages", func(db *gorm.DB) *gorm.DB {
			return db.Order("created_at ASC").Preload("User")
		}).
		First(&ticket, ticketID)

	if result.Error != nil {
		utils.NotFoundError(c, "ticket_not_found")
		return
	}

	// Convert messages
	messages := make([]dto.TicketMessageResponse, len(ticket.Messages))
	for i, msg := range ticket.Messages {
		messages[i] = messageToResponse(msg)
	}

	response := dto.TicketDetailResponse{
		TicketResponse: ticketToResponse(ticket),
		Messages:       messages,
	}

	utils.OKResponse(c, response)
}

// ResolveTicket allows an admin to resolve a ticket
func ResolveTicket(c *gin.Context) {
	ticketID := c.Param("id")

	var ticket models.Ticket
	if err := config.DB.Preload("User").First(&ticket, ticketID).Error; err != nil {
		utils.NotFoundError(c, "ticket_not_found")
		return
	}

	now := time.Now()
	ticket.Status = models.TicketStatusResolved
	ticket.ResolvedAt = &now

	if err := config.DB.Save(&ticket).Error; err != nil {
		utils.InternalServerError(c, "failed_to_resolve_ticket")
		return
	}

	// Send WebSocket notification to ticket owner and admins (including the one who resolved)
	event := dto.TicketWebSocketEvent{
		Event:    "ticket_resolved",
		TicketID: ticket.ID,
	}
	debug.Log("Sending ticket_resolved WebSocket event for ticket %d", ticket.ID)
	sendTicketWebSocketEvent(event, &ticket.UserID, ticket.TeamID, 0) // Don't exclude anyone

	utils.OKResponse(c, gin.H{"message": "ticket_resolved"})
}

// AdminReplyTicket allows an admin to reply to a ticket
func AdminReplyTicket(c *gin.Context) {
	adminID := c.GetUint("user_id")
	ticketID := c.Param("id")

	// Get admin info
	var admin models.User
	if err := config.DB.First(&admin, adminID).Error; err != nil {
		utils.InternalServerError(c, "user_not_found")
		return
	}

	var input dto.TicketMessageInput
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.BadRequestError(c, "invalid_input")
		return
	}

	// Get ticket
	var ticket models.Ticket
	if err := config.DB.First(&ticket, ticketID).Error; err != nil {
		utils.NotFoundError(c, "ticket_not_found")
		return
	}

	// Create message
	message := models.TicketMessage{
		TicketID:    ticket.ID,
		UserID:      adminID,
		Message:     input.Message,
		IsAdmin:     true,
		Attachments: input.Attachments,
	}

	if err := config.DB.Create(&message).Error; err != nil {
		utils.InternalServerError(c, "message_creation_failed")
		return
	}

	// Update ticket updated_at
	config.DB.Model(&ticket).Update("updated_at", time.Now())

	// Load user for response
	config.DB.Preload("User").First(&message, message.ID)

	// Send WebSocket notification to ticket owner
	event := dto.TicketWebSocketEvent{
		Event:       "ticket_message",
		TicketID:    ticket.ID,
		MessageID:   message.ID,
		UserID:      adminID,
		Username:    admin.Username,
		Message:     input.Message,
		Attachments: message.Attachments,
		CreatedAt:   message.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		IsAdmin:     true,
	}
	sendTicketWebSocketEvent(event, &ticket.UserID, ticket.TeamID, adminID)

	utils.CreatedResponse(c, messageToResponse(message))
}

// DeleteTicket allows an admin to delete a ticket
func DeleteTicket(c *gin.Context) {
	ticketID := c.Param("id")

	var ticket models.Ticket
	if err := config.DB.First(&ticket, ticketID).Error; err != nil {
		utils.NotFoundError(c, "ticket_not_found")
		return
	}

	// Delete all messages first
	if err := config.DB.Where("ticket_id = ?", ticket.ID).Delete(&models.TicketMessage{}).Error; err != nil {
		utils.InternalServerError(c, "failed_to_delete_ticket")
		return
	}

	// Delete ticket
	if err := config.DB.Delete(&ticket).Error; err != nil {
		utils.InternalServerError(c, "failed_to_delete_ticket")
		return
	}

	utils.OKResponse(c, gin.H{"message": "ticket_deleted"})
}
