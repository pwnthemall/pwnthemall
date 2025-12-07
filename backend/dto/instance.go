package dto

import (
	"time"

	"github.com/pwnthemall/pwnthemall/backend/models"
)

type InstanceDTO struct {
	ID          uint             `json:"id"`
	Name        string           `json:"name"`
	UserID      uint             `json:"userId"`
	TeamID      uint             `json:"teamId"`
	ChallengeID uint             `json:"challengeId"`
	User        models.User      `json:"user"`
	Team        models.Team      `json:"team"`
	Challenge   models.Challenge `json:"challenge"`
	CreatedAt   time.Time        `json:"createdAt"`
}

type AdminInstanceDTO struct {
	ID            uint      `json:"id"`
	Name          string    `json:"name"`
	UserID        uint      `json:"userId"`
	Username      string    `json:"username"`
	TeamID        uint      `json:"teamId"`
	TeamName      string    `json:"teamName"`
	ChallengeID   uint      `json:"challengeId"`
	ChallengeName string    `json:"challengeName"`
	Category      string    `json:"category"`
	Status        string    `json:"status"`
	CreatedAt     time.Time `json:"createdAt"`
	ExpiresAt     time.Time `json:"expiresAt"`
}
