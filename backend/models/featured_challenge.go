package models

import (
	"time"

	"github.com/lib/pq"
)

// FeaturedChallengeConfig stores the configuration for featured challenges display
type FeaturedChallengeConfig struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	Mode        string         `json:"mode"` // "manual", "most_solved", "highest_points", "active_first_blood"
	ChallengeIDs pq.Int64Array `gorm:"type:integer[]" json:"challengeIds"` // Used when mode is "manual"
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
}
