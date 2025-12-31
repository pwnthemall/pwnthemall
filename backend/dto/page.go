package dto

type PageDTO struct {
	ID           uint       `gorm:"primaryKey" json:"id"`
	Slug         string     `gorm:"uniqueIndex;not null" json:"slug"`
	Title        string     `gorm:"not null" json:"title"`
	IsInSidebar  bool       `gorm:"default:false" json:"is_in_sidebar"`
	Order        int        `gorm:"default:0" json:"order"`
}