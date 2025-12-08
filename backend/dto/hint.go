package dto

type HintNotPurchased struct {
	ID          uint   `gorm:"primaryKey" json:"id"`
	ChallengeID uint   `json:"challengeId"`
	Title       string `gorm:"not null;default:'Hint'" json:"title"`
	Cost        int    `gorm:"not null;default:0" json:"cost"`
	IsActive    bool   `gorm:"not null" json:"isActive"`
}

// HintRequest represents hint creation/update request
type HintRequest struct {
	Content string `json:"content" binding:"required"`
	Cost    int    `json:"cost" binding:"min=0"`
}

// HintWithPurchased represents a hint with purchase status
type HintWithPurchased struct {
	Hint
	Purchased bool `json:"purchased"`
}

type Hint struct {
	ID          uint   `json:"id"`
	ChallengeID uint   `json:"challengeId"`
	Title       string `json:"title"`
	Content     string `json:"content"`
	Cost        int    `json:"cost"`
	IsActive    bool   `json:"isActive"`
}
