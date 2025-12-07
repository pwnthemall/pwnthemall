package dto

import "github.com/pwnthemall/pwnthemall/backend/models"

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
	Difficulty        *uint          `json:"difficulty"`
	Category          *uint          `json:"category"`
	Type              *uint          `json:"type"`
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
	Name           string `json:"name" binding:"required"`
	Description    string `json:"description" binding:"required"`
	Author         string `json:"author"`
	Hidden         *bool  `json:"hidden"`
	CategoryID     *uint  `json:"categoryId"`
	DifficultyID   *uint  `json:"difficultyId"`
	CoverPositionX *float64 `json:"coverPositionX"`
	CoverPositionY *float64 `json:"coverPositionY"`
	CoverZoom      *float64 `json:"coverZoom"`
}

// HintRequest represents hint creation/update request
type HintRequest struct {
	Content string `json:"content" binding:"required"`
	Cost    int    `json:"cost" binding:"min=0"`
}

// HintWithPurchased represents a hint with purchase status
type HintWithPurchased struct {
	models.Hint
	Purchased bool `json:"purchased"`
}

// ChallengeWithSolved represents a challenge with solve status and hints
type ChallengeWithSolved struct {
	models.Challenge
	Solved             bool                `json:"solved"`
	Locked             bool                `json:"locked,omitempty"`       // True if depends_on requirement not met
	Hints              []HintWithPurchased `json:"hints,omitempty"`
	GeoRadiusKm        *float64            `json:"geoRadiusKm,omitempty"`
	TeamFailedAttempts int64               `json:"teamFailedAttempts,omitempty"`
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
	Name      string      `json:"name,omitempty"`
	ChallengeID    uint        `json:"challengeId,omitempty"`
	Status         string      `json:"status,omitempty"`
	UpdatedAt      int64       `json:"updatedAt,omitempty"`
	CreatedAt      int64       `json:"createdAt,omitempty"`
	ExpiresAt      int64       `json:"expiresAt,omitempty"`
	Ports          interface{} `json:"ports,omitempty"`
	ConnectionInfo interface{} `json:"connectionInfo,omitempty"`
}
