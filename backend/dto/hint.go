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

// HintPurchaseEvent represents a hint purchase WebSocket event
type HintPurchaseEvent struct {
	Event       string `json:"event"`
	TeamID      uint   `json:"teamId"`
	ChallengeID uint   `json:"challengeId"`
	HintID      uint   `json:"hintId"`
	UserID      uint   `json:"userId"`
	Username    string `json:"username"`
	HintTitle   string `json:"hintTitle"`
	HintContent string `json:"hintContent"`
	Cost        int    `json:"cost"`
	Timestamp   int64  `json:"timestamp"`
}
