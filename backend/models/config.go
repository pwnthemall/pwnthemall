package models

type Config struct {
	Key         string `gorm:"primaryKey" json:"key"`
	Value       string `json:"value"`
	Public      bool   `gorm:"default:false" json:"public"`
	SyncWithEnv bool   `gorm:"default:false" json:"syncWithEnv"`
	Encrypted   bool   `gorm:"default:false" json:"encrypted"` // Indicates if Value is AES-256-GCM encrypted
}
