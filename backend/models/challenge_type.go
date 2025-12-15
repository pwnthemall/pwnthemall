package models

type ChallengeType struct {
	ID         uint        `gorm:"primaryKey" json:"id"`
	Name       string      `gorm:"unique;not null" json:"name"`
	Instance   bool        `gorm:"not null;default:false" json:"instance"`
	Challenges []Challenge `json:"challenges"`
}
