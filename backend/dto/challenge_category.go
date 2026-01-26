package dto

// ChallengeCategoryInput represents challenge category creation/update request
type ChallengeCategoryInput struct {
	Name        string `json:"name" binding:"required,max=100"`
	Description string `json:"description"`
	Icon        string `json:"icon"`
}

type ChallengeCategory struct {
	ID         uint        `gorm:"primaryKey" json:"id"`
	Name       string      `gorm:"unique;not null" json:"name"`
	Challenges []SafeChallenge `json:"challenges"`
}