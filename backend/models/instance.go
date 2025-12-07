package models

import (
	"time"

	"github.com/lib/pq"
)

type Instance struct {
	ID          uint          `gorm:"primaryKey" json:"id"`
	Name        string        `json:"name"`
	User        User          `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"user"`
	UserID      uint          `json:"userId"`
	Team        Team          `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"team"`
	TeamID      uint          `gorm:"index;uniqueIndex:uniq_team_challenge" json:"teamId"`
	Challenge   Challenge     `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"challenge"`
	ChallengeID uint          `gorm:"index;uniqueIndex:uniq_team_challenge" json:"challengeId"`
	CreatedAt   time.Time     `json:"createdAt"`
	Ports       pq.Int64Array `gorm:"type:integer[]" json:"ports"`
	ExpiresAt   time.Time     `json:"expiresAt"`
	Status      string        `json:"status" gorm:"default:'running'"` // running, stopped, expired
}
