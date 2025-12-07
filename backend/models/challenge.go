package models

import (
	"time"

	"github.com/lib/pq"
)

type Challenge struct {
	ID                    uint                 `gorm:"primaryKey" json:"id"`
	Slug                  string               `gorm:"unique;not null" json:"slug"`
	Name                  string               `json:"name"`
	Description           string               `json:"description"`
	ChallengeDifficultyID uint                 `json:"difficultyId"`
	ChallengeDifficulty   *ChallengeDifficulty `gorm:"foreignKey:ChallengeDifficultyID" json:"difficulty,omitempty"`
	ChallengeCategoryID   uint                 `json:"categoryId"`
	ChallengeCategory     *ChallengeCategory   `gorm:"foreignKey:ChallengeCategoryID" json:"category,omitempty"`
	ChallengeTypeID       uint                 `json:"typeId"`
	ChallengeType         *ChallengeType       `gorm:"foreignKey:ChallengeTypeID" json:"type,omitempty"`
	CreatedAt             time.Time            `json:"createdAt"`
	UpdatedAt             time.Time            `json:"updatedAt"`
	Author                string               `json:"author"`
	Hidden                bool                 `json:"hidden"`
	Flags                 []Flag               `gorm:"foreignKey:ChallengeID;constraint:OnDelete:CASCADE;" json:"-"`
	Files                 pq.StringArray       `gorm:"type:text[]" json:"files"`
	Ports                 pq.Int64Array        `gorm:"type:integer[]" json:"ports"`
	ConnectionInfo        pq.StringArray       `gorm:"type:text[]" json:"connectionInfo"`
	Points                int                  `json:"points"` // maybe rename it basePoints
	CurrentPoints         int                  `gorm:"-" json:"currentPoints"`
	Order                 int                  `json:"order" gorm:"default:0"`
	DecayFormulaID        uint                 `json:"decayFormulaId,omitempty"`
	DecayFormula          *DecayFormula        `gorm:"foreignKey:DecayFormulaID" json:"decayFormula,omitempty"`
	Hints                 []Hint               `gorm:"foreignKey:ChallengeID;constraint:OnDelete:CASCADE;" json:"hints,omitempty"`
	FirstBlood            *FirstBlood          `gorm:"foreignKey:ChallengeID;constraint:OnDelete:CASCADE;" json:"firstBlood,omitempty"`
	EnableFirstBlood      bool                 `gorm:"default:false" json:"enableFirstBlood"`
	FirstBloodBonuses     pq.Int64Array        `gorm:"type:integer[]" json:"firstBloodBonuses"`
	FirstBloodBadges      pq.StringArray       `gorm:"type:text[]" json:"firstBloodBadges"`
	MaxAttempts           int                  `gorm:"default:0" json:"maxAttempts"`     // 0 = unlimited attempts
	DependsOn             string               `json:"dependsOn,omitempty"`              // Name of the challenge that must be solved first
	CoverImg              string               `json:"coverImg,omitempty"`               // Cover image filename (e.g., "cover_resized.webp")
	Emoji                 string               `json:"emoji,omitempty"`                  // Emoji to display when no cover image
	CoverPositionX        float64              `gorm:"default:50" json:"coverPositionX"` // X position for cover image (0-100, default 50 = center)
	CoverPositionY        float64              `gorm:"default:50" json:"coverPositionY"` // Y position for cover image (0-100, default 50 = center)
	CoverZoom             float64              `gorm:"default:100" json:"coverZoom"`     // Zoom level for cover image (100-200, default 100 = no zoom)
}

func (c *Challenge) GetID() uint {
	return c.ID
}

func (c *Challenge) GetSlug() string {
	return c.Slug
}

func (c *Challenge) GetType() string {
	if c.ChallengeType != nil {
		return c.ChallengeType.Name
	}
	return ""
}

func (c *Challenge) GetPorts() []int64 {
	return c.Ports
}

func (c *Challenge) GetConnectionInfo() []string {
	return c.ConnectionInfo
}
