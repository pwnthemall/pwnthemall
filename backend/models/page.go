package models

import "time"

type Page struct {
	ID           uint       `gorm:"primaryKey" json:"id"`
	Slug         string     `gorm:"uniqueIndex;not null" json:"slug"`
	Title        string     `gorm:"not null" json:"title"`
	MinioKey     string     `gorm:"not null" json:"minio_key"`
	IsInSidebar  bool       `gorm:"default:false" json:"is_in_sidebar"`
	Order        int        `gorm:"default:0" json:"order"`
	Source       string     `gorm:"default:'ui'" json:"source"` // 'ui' or 'minio'
	LastSyncedAt *time.Time `json:"last_synced_at,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

func (Page) TableName() string {
	return "pages"
}
