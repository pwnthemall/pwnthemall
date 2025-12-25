package models

import "time"

type Page struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Slug      string    `gorm:"uniqueIndex;not null" json:"slug"`
	Title     string    `gorm:"not null" json:"title"`
	MinioKey  string    `gorm:"not null" json:"minio_key"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (Page) TableName() string {
	return "pages"
}
