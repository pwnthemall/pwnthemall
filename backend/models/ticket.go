package models

import (
	"time"

	"github.com/lib/pq"
)

// TicketStatus represents the possible states of a ticket
type TicketStatus string

const (
	TicketStatusOpen     TicketStatus = "open"
	TicketStatusResolved TicketStatus = "resolved"
)

// TicketType represents whether the ticket is for a user or team
type TicketType string

const (
	TicketTypeUser TicketType = "user"
	TicketTypeTeam TicketType = "team"
)

// Ticket represents a support ticket in the system
type Ticket struct {
	ID          uint         `gorm:"primaryKey" json:"id"`
	Subject     string       `gorm:"size:255;not null" json:"subject"`
	Description string       `gorm:"type:text;not null" json:"description"`
	Status      TicketStatus `gorm:"size:20;default:'open'" json:"status"`
	TicketType  TicketType   `gorm:"size:20;not null" json:"ticketType"`

	// Creator
	UserID uint `gorm:"not null" json:"userId"`
	User   User `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"user,omitempty"`

	// Optional team association (for team tickets)
	TeamID *uint `json:"teamId,omitempty"`
	Team   Team  `gorm:"constraint:OnUpdate:CASCADE,OnDelete:SET NULL;" json:"team,omitempty"`

	// Optional challenge reference
	ChallengeID *uint     `json:"challengeId,omitempty"`
	Challenge   Challenge `gorm:"constraint:OnUpdate:CASCADE,OnDelete:SET NULL;" json:"challenge,omitempty"`

	// Admin who claimed the ticket
	ClaimedByID *uint `json:"claimedById,omitempty"`
	ClaimedBy   User  `gorm:"foreignKey:ClaimedByID" json:"claimedBy,omitempty"`

	// File attachments (MinIO paths)
	Attachments pq.StringArray `gorm:"type:text[]" json:"attachments"`

	// Timestamps
	CreatedAt  time.Time  `json:"createdAt"`
	UpdatedAt  time.Time  `json:"updatedAt"`
	ClaimedAt  *time.Time `json:"claimedAt,omitempty"`
	ResolvedAt *time.Time `json:"resolvedAt,omitempty"`

	// Messages relation (for chat)
	Messages []TicketMessage `gorm:"foreignKey:TicketID" json:"messages,omitempty"`
}

// TableName specifies the table name for Ticket
func (Ticket) TableName() string {
	return "tickets"
}
