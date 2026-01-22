package models

import (
	"time"

	"github.com/lib/pq"
)

// TeamChatMessage represents a message in team chat
type TeamChatMessage struct {
	ID     uint `gorm:"primaryKey" json:"id"`
	TeamID uint `gorm:"not null;index" json:"teamId"`
	Team   Team `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"-"`

	// Message author
	UserID uint `gorm:"not null" json:"userId"`
	User   User `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"user,omitempty"`

	// Message content
	Message string `gorm:"type:text;not null" json:"message"`

	// Attachments (MinIO paths)
	Attachments pq.StringArray `gorm:"type:text[]" json:"attachments"`

	CreatedAt time.Time `json:"createdAt"`
}

// TableName specifies the table name for TeamChatMessage
func (TeamChatMessage) TableName() string {
	return "team_chat_messages"
}
