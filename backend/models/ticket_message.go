package models

import (
	"time"

	"github.com/lib/pq"
)

// TicketMessage represents a message within a ticket (chat-like)
type TicketMessage struct {
	ID       uint   `gorm:"primaryKey" json:"id"`
	TicketID uint   `gorm:"not null;index" json:"ticketId"`
	Ticket   Ticket `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"-"`

	// Message author
	UserID uint `gorm:"not null" json:"userId"`
	User   User `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"user,omitempty"`

	// Message content
	Message string `gorm:"type:text;not null" json:"message"`
	IsAdmin bool   `gorm:"default:false" json:"isAdmin"`

	// Attachments (MinIO paths)
	Attachments pq.StringArray `gorm:"type:text[]" json:"attachments"`

	CreatedAt time.Time `json:"createdAt"`
}

// TableName specifies the table name for TicketMessage
func (TicketMessage) TableName() string {
	return "ticket_messages"
}
