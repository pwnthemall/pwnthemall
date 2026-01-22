package models

import (
	"time"
)

// used to have persistence on invalidated JWT tokens
type BlacklistedToken struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Token     string    `gorm:"uniqueIndex;size:512;not null" json:"-"`
	ExpiresAt time.Time `gorm:"index;not null" json:"expiresAt"`
	CreatedAt time.Time `json:"createdAt"`
}
