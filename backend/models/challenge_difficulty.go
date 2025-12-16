package models

type ChallengeDifficulty struct {
	ID         uint        `gorm:"primaryKey" json:"id"`
	Name       string      `gorm:"unique;not null" json:"name"`
	Color      string      `gorm:"default:'#22c55e'" json:"color"` // HEX color code (e.g., #22c55e)
	Challenges []Challenge `json:"challenges"`
}
