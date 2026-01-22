package dto

// TeamChatMessageInput represents input when sending a team chat message
type TeamChatMessageInput struct {
	Message     string   `json:"message" binding:"required,min=1,max=2000"`
	Attachments []string `json:"attachments"`
}

// TeamChatMessageResponse represents a team chat message for responses
type TeamChatMessageResponse struct {
	ID          uint     `json:"id"`
	TeamID      uint     `json:"teamId"`
	UserID      uint     `json:"userId"`
	Username    string   `json:"username"`
	Message     string   `json:"message"`
	Attachments []string `json:"attachments"`
	CreatedAt   string   `json:"createdAt"`
}

// TeamChatWebSocketEvent represents a real-time team chat event
type TeamChatWebSocketEvent struct {
	Event       string   `json:"event"` // "team_message"
	TeamID      uint     `json:"teamId"`
	MessageID   uint     `json:"messageId"`
	UserID      uint     `json:"userId"`
	Username    string   `json:"username"`
	Message     string   `json:"message"`
	Attachments []string `json:"attachments"`
	CreatedAt   string   `json:"createdAt"`
}
