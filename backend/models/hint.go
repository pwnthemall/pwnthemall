package models

import (
	"time"
)

type Hint struct {
	ID           uint       `gorm:"primaryKey" json:"id"`
	ChallengeID  uint       `json:"challengeId"`
	Challenge    *Challenge `gorm:"foreignKey:ChallengeID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"challenge,omitempty"`
	Title        string     `gorm:"not null;default:'Hint'" json:"title"`
	Content      string     `gorm:"not null" json:"content"`
	Cost         int        `gorm:"not null;default:0" json:"cost"`
	IsActive     bool       `gorm:"not null" json:"isActive"`
	AutoActiveAt *time.Time `json:"autoActiveAt"`
	CreatedAt    time.Time  `json:"createdAt"`
	UpdatedAt    time.Time  `json:"updatedAt"`
}
