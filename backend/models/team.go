package models

import (
	"time"
	"gorm.io/gorm"
)

type Team struct {
	ID            uint           `gorm:"primaryKey" json:"id"`
	Name          string         `gorm:"not null;uniqueIndex:idx_teams_name_deleted" json:"name"`
	Password      string         `json:"-"`
	CreatorID     uint           `json:"creatorId"`
	Creator       User           `gorm:"constraint:OnUpdate:CASCADE,OnDelete:SET NULL;" json:"creator,omitempty"`
	CreatedAt     time.Time      `json:"createdAt"`
	UpdatedAt     time.Time      `json:"updatedAt"`
	DeletedAt     gorm.DeletedAt `gorm:"index;uniqueIndex:idx_teams_name_deleted" json:"-"`
	Solves        []Solve           `json:"solves,omitempty"`
	Users         []User            `gorm:"foreignKey:TeamID" json:"users,omitempty"`
	HintPurchases []HintPurchase    `json:"hintPurchases,omitempty"`
	ChatMessages  []TeamChatMessage `gorm:"foreignKey:TeamID" json:"chatMessages,omitempty"`
}
