package dto

import (
	"github.com/pwnthemall/pwnthemall/backend/models"
)

// FlagInput represents flag submission request
type FlagInput struct {
	Flag string `json:"flag" binding:"required"`
}

// GeoFlagInput represents geo challenge submission request
type GeoFlagInput struct {
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
}

// ChallengeAdminUpdateRequest represents admin challenge update request
type ChallengeAdminUpdateRequest struct {
	Name              *string        `json:"name"`
	Description       *string        `json:"description"`
	DifficultyID      *uint          `json:"difficultyId"`
	CategoryID        *uint          `json:"categoryId"`
	TypeID            *uint          `json:"typeId"`
	Hidden            *bool          `json:"hidden"`
	Points            *int           `json:"points"`
	DecayFormulaID    *uint          `json:"decayFormulaId"`
	EnableFirstBlood  *bool          `json:"enableFirstBlood"`
	FirstBloodBonuses *[]int64       `json:"firstBloodBonuses"`
	FirstBloodBadges  *[]string      `json:"firstBloodBadges"`
	Hints             *[]models.Hint `json:"hints"`
}

// ChallengeGeneralUpdateRequest represents general challenge info update
type ChallengeGeneralUpdateRequest struct {
	Name           string   `json:"name" binding:"required"`
	Description    string   `json:"description" binding:"required"`
	Author         string   `json:"author"`
	Hidden         *bool    `json:"hidden"`
	CategoryID     *uint    `json:"categoryId"`
	DifficultyID   *uint    `json:"difficultyId"`
	CoverPositionX *float64 `json:"coverPositionX"`
	CoverPositionY *float64 `json:"coverPositionY"`
	CoverZoom      *float64 `json:"coverZoom"`
}

// ChallengeWithSolved represents a challenge with solve status and hints
type ChallengeWithSolved struct {
	SafeChallenge
	Solved             bool     `json:"solved"`
	Locked             bool     `json:"locked,omitempty"` // True if depends_on requirement not met
	GeoRadiusKm        *float64 `json:"geoRadiusKm,omitempty"`
	TeamFailedAttempts int64    `json:"teamFailedAttempts,omitempty"`
}

// SolveWithUser represents a solve with user information
type SolveWithUser struct {
	models.Solve
	Username      string             `json:"username"`
	FirstBlood    *models.FirstBlood `json:"firstBlood,omitempty"`
	CurrentPoints int                `json:"currentPoints"` // Current decayed points of the challenge
}

// TeamSolveEvent represents a team solve WebSocket event
type TeamSolveEvent struct {
	Type          string `json:"type"`
	Event         string `json:"event"`
	ChallengeID   uint   `json:"challengeId"`
	ChallengeName string `json:"challengeName"`
	ChallengeSlug string `json:"challengeSlug,omitempty"`
	TeamID        uint   `json:"teamId"`
	UserID        uint   `json:"userId"`
	Username      string `json:"username"`
	Points        int    `json:"points"`
	Timestamp     int64  `json:"timestamp"`
}

// InstanceEvent represents an instance WebSocket event
type InstanceEvent struct {
	Type           string      `json:"type"`
	Event          string      `json:"event"`
	TeamID         uint        `json:"teamId"`
	UserID         uint        `json:"userId"`
	Username       string      `json:"username,omitempty"`
	Name           string      `json:"name,omitempty"`
	ChallengeID    uint        `json:"challengeId,omitempty"`
	Status         string      `json:"status,omitempty"`
	UpdatedAt      int64       `json:"updatedAt,omitempty"`
	CreatedAt      int64       `json:"createdAt,omitempty"`
	ExpiresAt      int64       `json:"expiresAt,omitempty"`
	Ports          interface{} `json:"ports,omitempty"`
	ConnectionInfo interface{} `json:"connectionInfo,omitempty"`
}

type SafeChallenge struct {
	ID                    uint                        `json:"id"`
	Slug                  string                      `json:"slug"`
	Name                  string                      `json:"name"`
	Description           string                      `json:"description"`
	ChallengeDifficultyID uint                        `json:"difficultyId"`
	ChallengeDifficulty   *models.ChallengeDifficulty `json:"challengeDifficulty"`
	ChallengeCategoryID   uint                        `json:"categoryId"`
	ChallengeCategory     *ChallengeCategory          `json:"challengeCategory"`
	ChallengeTypeID       uint                        `json:"typeId"`
	ChallengeType         *models.ChallengeType       `json:"challengeType"`
	Author                string                      `json:"author"`
	Points                int                         `json:"points"` // maybe rename it basePoints
	CurrentPoints         int                         `json:"currentPoints"`
	Order                 int                         `json:"order" gorm:"default:0"`
	CoverImg              string                      `json:"coverImg,omitempty"` // Cover image filename (e.g., "cover_resized.webp")
	Emoji                 string                      `json:"emoji,omitempty"`    // Emoji to display when no cover image
	CoverPositionX        float64                     `json:"coverPositionX"`     // X position for cover image (0-100, default 50 = center)
	CoverPositionY        float64                     `json:"coverPositionY"`     // Y position for cover image (0-100, default 50 = center)
	CoverZoom             float64                     `json:"coverZoom"`          // Zoom level for cover image (100-200, default 100 = no zoom)
	Hints                 []HintWithPurchased         `json:"hints,omitempty"`
}
