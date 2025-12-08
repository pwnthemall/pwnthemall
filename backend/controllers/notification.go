package controllers

import (
	"github.com/pwnthemall/pwnthemall/backend/debug"
	"encoding/json"
	

	"time"

	"github.com/gin-gonic/gin"
	"github.com/jinzhu/copier"
	"github.com/pwnthemall/pwnthemall/backend/config"
	"github.com/pwnthemall/pwnthemall/backend/dto"
	"github.com/pwnthemall/pwnthemall/backend/models"
	"github.com/pwnthemall/pwnthemall/backend/utils"
)

// SendNotification sends a notification to users
func SendNotification(c *gin.Context) {
	var input dto.NotificationInput
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.BadRequestError(c, "Invalid input")
		return
	}

	// Get the sender's user ID
	senderID := c.GetUint("user_id")

	// Create notification in database
	var notification models.Notification
	copier.Copy(&notification, &input)

	if err := config.DB.Create(&notification).Error; err != nil {
		utils.InternalServerError(c, "Failed to create notification")
		return
	}

	// Prepare notification message for WebSocket
	var notificationMsg dto.NotificationResponse
	copier.Copy(&notificationMsg, &notification)

	// Send notification via WebSocket if available
	messageBytes, err := json.Marshal(notificationMsg)
	if err != nil {
		utils.InternalServerError(c, "Failed to marshal notification")
		return
	}

	// Send via WebSocket
	if input.UserID != nil {
		// Send to specific user
		utils.WebSocketHub.SendToUser(*input.UserID, messageBytes)
	} else if input.TeamID != nil {
		// Send to all users in the team
		utils.WebSocketHub.SendToTeam(*input.TeamID, messageBytes)
	} else {
		// Send to all connected users except the sender
		utils.WebSocketHub.SendToAllExcept(messageBytes, senderID)
	}

	utils.CreatedResponse(c, notificationMsg)
}

// GetUserNotifications retrieves notifications for the current user
func GetUserNotifications(c *gin.Context) {
	userID := c.GetUint("user_id")

	var notifications []models.Notification

	// Get user's team ID
	var user models.User
	if err := config.DB.First(&user, userID).Error; err != nil {
		utils.InternalServerError(c, "Failed to fetch user")
		return
	}

	// Build query for notifications: user-specific, team-specific, or global
	query := config.DB.Where("user_id = ? OR user_id IS NULL", userID)
	if user.TeamID != nil {
		query = query.Or("team_id = ?", *user.TeamID)
	}

	result := query.Order("created_at DESC").Limit(50).Find(&notifications)

	if result.Error != nil {
		utils.InternalServerError(c, "Failed to fetch notifications")
		return
	}

	// Convert to response format
	var response []dto.NotificationResponse
	for _, notification := range notifications {
		var notifResp dto.NotificationResponse
		copier.Copy(&notifResp, &notification)
		response = append(response, notifResp)
	}

	// Ensure we always return an array, even if empty
	if response == nil {
		response = []dto.NotificationResponse{}
	}

	// Log the response for debugging
	debug.Log("User %d notifications: %+v", userID, response)

	utils.OKResponse(c, response)
}

// MarkNotificationAsRead marks a notification as read
func MarkNotificationAsRead(c *gin.Context) {
	userID := c.GetUint("user_id")
	notificationID := c.Param("id")

	var notification models.Notification

	// Get user's team ID
	var user models.User
	if err := config.DB.First(&user, userID).Error; err != nil {
		utils.InternalServerError(c, "Failed to fetch user")
		return
	}

	// Build query for notifications: user-specific, team-specific, or global
	query := config.DB.Where("id = ? AND (user_id = ? OR user_id IS NULL)", notificationID, userID)
	if user.TeamID != nil {
		query = query.Or("id = ? AND team_id = ?", notificationID, *user.TeamID)
	}

	result := query.First(&notification)

	if result.Error != nil {
		utils.NotFoundError(c, "Notification not found")
		return
	}

	now := time.Now()
	notification.ReadAt = &now

	if err := config.DB.Save(&notification).Error; err != nil {
		utils.InternalServerError(c, "Failed to mark notification as read")
		return
	}

	utils.OKResponse(c, gin.H{"message": "Notification marked as read"})
}

// MarkAllNotificationsAsRead marks all notifications for a user as read
func MarkAllNotificationsAsRead(c *gin.Context) {
	userID := c.GetUint("user_id")

	// Get user's team ID
	var user models.User
	if err := config.DB.First(&user, userID).Error; err != nil {
		utils.InternalServerError(c, "Failed to fetch user")
		return
	}

	now := time.Now()
	query := config.DB.Model(&models.Notification{}).
		Where("(user_id = ? OR user_id IS NULL) AND read_at IS NULL", userID)

	if user.TeamID != nil {
		query = query.Or("team_id = ? AND read_at IS NULL", *user.TeamID)
	}

	result := query.Update("read_at", now)

	if result.Error != nil {
		utils.InternalServerError(c, "Failed to mark notifications as read")
		return
	}

	utils.OKResponse(c, gin.H{"message": "All notifications marked as read"})
}

// GetUnreadCount returns the count of unread notifications for the current user
func GetUnreadCount(c *gin.Context) {
	userID := c.GetUint("user_id")

	// Get user's team ID
	var user models.User
	if err := config.DB.First(&user, userID).Error; err != nil {
		utils.InternalServerError(c, "Failed to fetch user")
		return
	}

	var count int64
	query := config.DB.Model(&models.Notification{}).
		Where("(user_id = ? OR user_id IS NULL) AND read_at IS NULL", userID)

	if user.TeamID != nil {
		query = query.Or("team_id = ? AND read_at IS NULL", *user.TeamID)
	}

	result := query.Count(&count)

	if result.Error != nil {
		utils.InternalServerError(c, "Failed to get unread count")
		return
	}

	// Log the count for debugging
	debug.Log("User %d unread count: %d", userID, count)

	utils.OKResponse(c, gin.H{"count": count})
}

// GetSentNotifications retrieves all sent notifications (admin only)
func GetSentNotifications(c *gin.Context) {
	var notifications []models.Notification
	result := config.DB.Preload("User").Preload("Team").Order("created_at DESC").Limit(100).Find(&notifications)

	if result.Error != nil {
		utils.InternalServerError(c, "Failed to fetch notifications")
		return
	}

	// Log the raw notifications for debugging
	debug.Log("Raw notifications from DB: %+v", notifications)

	// Convert to response format with user info

	var response []dto.SentNotificationResponse
	for _, notification := range notifications {
		var resp dto.SentNotificationResponse
		copier.Copy(&resp, &notification)

		if notification.User != nil {
			resp.Username = &notification.User.Username
		}

		if notification.Team != nil {
			resp.TeamName = &notification.Team.Name
		}

		response = append(response, resp)
	}

	// Ensure we always return an array, even if empty
	if response == nil {
		response = []dto.SentNotificationResponse{}
	}

	debug.Log("Final response: %+v", response)
	utils.OKResponse(c, response)
}

// DeleteNotification deletes a notification (admin only)
func DeleteNotification(c *gin.Context) {
	notificationID := c.Param("id")

	var notification models.Notification
	if err := config.DB.First(&notification, notificationID).Error; err != nil {
		utils.NotFoundError(c, "Notification not found")
		return
	}

	if err := config.DB.Delete(&notification).Error; err != nil {
		utils.InternalServerError(c, "Failed to delete notification")
		return
	}

	utils.OKResponse(c, gin.H{"message": "Notification deleted"})
}
