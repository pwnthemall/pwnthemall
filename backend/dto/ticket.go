package dto

import "time"

// TicketInput represents the input for creating a ticket
type TicketInput struct {
	Subject     string   `json:"subject" binding:"required,max=255"`
	Description string   `json:"description" binding:"required"`
	TicketType  string   `json:"ticketType" binding:"required,oneof=user team"`
	TeamID      *uint    `json:"teamId"`
	ChallengeID *uint    `json:"challengeId"`
	Attachments []string `json:"attachments"`
}

// TicketMessageInput represents the input for sending a message in a ticket
type TicketMessageInput struct {
	Message     string   `json:"message" binding:"required"`
	Attachments []string `json:"attachments"`
}

// TicketResponse represents a ticket in API responses
type TicketResponse struct {
	ID            uint       `json:"id"`
	Subject       string     `json:"subject"`
	Description   string     `json:"description"`
	Status        string     `json:"status"`
	TicketType    string     `json:"ticketType"`
	UserID        uint       `json:"userId"`
	Username      string     `json:"username,omitempty"`
	TeamID        *uint      `json:"teamId,omitempty"`
	TeamName      *string    `json:"teamName,omitempty"`
	ChallengeID   *uint      `json:"challengeId,omitempty"`
	ChallengeName *string    `json:"challengeName,omitempty"`
	ChallengeSlug *string    `json:"challengeSlug,omitempty"`
	ClaimedByID   *uint      `json:"claimedById,omitempty"`
	ClaimedByName *string    `json:"claimedByName,omitempty"`
	Attachments   []string   `json:"attachments"`
	CreatedAt     time.Time  `json:"createdAt"`
	UpdatedAt     time.Time  `json:"updatedAt"`
	ClaimedAt     *time.Time `json:"claimedAt,omitempty"`
	ResolvedAt    *time.Time `json:"resolvedAt,omitempty"`
	MessageCount  int        `json:"messageCount"`
	LastMessage   *string    `json:"lastMessage,omitempty"`
}

// TicketDetailResponse includes messages for the detail view
type TicketDetailResponse struct {
	TicketResponse
	Messages []TicketMessageResponse `json:"messages"`
}

// TicketMessageResponse represents a message in API responses
type TicketMessageResponse struct {
	ID          uint      `json:"id"`
	TicketID    uint      `json:"ticketId"`
	UserID      uint      `json:"userId"`
	Username    string    `json:"username"`
	Message     string    `json:"message"`
	IsAdmin     bool      `json:"isAdmin"`
	Attachments []string  `json:"attachments"`
	CreatedAt   time.Time `json:"createdAt"`
}

// TicketListResponse is the paginated list response
type TicketListResponse struct {
	Tickets    []TicketResponse `json:"tickets"`
	Total      int64            `json:"total"`
	Page       int              `json:"page"`
	PageSize   int              `json:"pageSize"`
	TotalPages int              `json:"totalPages"`
}

// TicketWebSocketEvent represents a WebSocket event for tickets
type TicketWebSocketEvent struct {
	Event         string   `json:"event"`
	TicketID      uint     `json:"ticketId"`
	Subject       string   `json:"subject,omitempty"`
	UserID        uint     `json:"userId,omitempty"`
	Username      string   `json:"username,omitempty"`
	TeamID        *uint    `json:"teamId,omitempty"`
	Message       string   `json:"message,omitempty"`
	MessageID     uint     `json:"messageId,omitempty"`
	Attachments   []string `json:"attachments,omitempty"`
	CreatedAt     string   `json:"createdAt,omitempty"`
	IsAdmin       bool     `json:"isAdmin,omitempty"`
	ClaimedByID   *uint    `json:"claimedById,omitempty"`
	ClaimedByName *string  `json:"claimedByName,omitempty"`
}
