package dto

import (
	"time"

	"github.com/pwnthemall/pwnthemall/backend/models"
)

type SubmissionResponse struct {
	ID          uint              `json:"id"`
	Value       string            `json:"value"`
	IsCorrect   bool              `json:"isCorrect"`
	CreatedAt   time.Time         `json:"createdAt"`
	User        SafeUserWithTeam  `json:"user"`
	ChallengeID uint              `json:"challengeId"`
	Challenge   *models.Challenge `gorm:"constraint:OnUpdate:CASCADE,OnDelete:SET NULL;" json:"challenge,omitempty"`
}
