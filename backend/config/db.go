package config

import (
	"os"

	"github.com/pwnthemall/pwnthemall/backend/debug"
	"github.com/pwnthemall/pwnthemall/backend/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func ConnectDB() *gorm.DB {
	dsn := os.Getenv("DATABASE_URL")
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		debug.Log("Failed to connect to database: %v", err)
		os.Exit(1)
	}

	err = db.AutoMigrate(
		&models.Config{}, &models.DockerConfig{},
		&models.Team{}, &models.Solve{},
		&models.User{}, &models.ChallengeCategory{},
		&models.ChallengeType{}, &models.ChallengeDifficulty{},
		&models.DecayFormula{}, &models.Challenge{}, &models.Flag{},
		&models.Hint{}, &models.HintPurchase{}, &models.FirstBlood{},
		&models.Submission{}, &models.Instance{}, &models.InstanceCooldown{}, &models.DynamicFlag{}, &models.GeoSpec{},
		&models.Notification{},
		&models.Ticket{}, &models.TicketMessage{},
		&models.Page{},
	&models.PasswordResetToken{}, // Password reset functionality
	&models.TeamChatMessage{},
	&models.FeaturedChallengeConfig{},
	)
	if err != nil {
		debug.Log("Failed to migrate database: %v", err)
		os.Exit(1)
	}

	DB = db

	// Migrate existing pages to have is_in_sidebar = true
	migrateExistingPages()

	// fixInstanceUserForeignKey()
	if os.Getenv("PTA_SEED_DATABASE") == "true" {
		SeedDatabase()
	}
	return db
}

// migrateExistingPages updates existing pages to have is_in_sidebar = true
func migrateExistingPages() {
	var count int64
	DB.Model(&models.Page{}).Where("is_in_sidebar = ?", false).Count(&count)

	if count > 0 {
		debug.Log("Migrating %d existing pages to set is_in_sidebar = true", count)
		result := DB.Model(&models.Page{}).
			Where("is_in_sidebar = ?", false).
			Updates(map[string]interface{}{
				"is_in_sidebar": true,
				"source":        "ui",
			})
		if result.Error != nil {
			debug.Log("Warning: Failed to migrate existing pages: %v", result.Error)
		} else {
			debug.Log("Successfully migrated %d pages", result.RowsAffected)
		}
	}
}

// func fixInstanceUserForeignKey() {
// 	DB.Exec(`ALTER TABLE instances DROP CONSTRAINT IF EXISTS fk_instances_user;`)
// 	DB.Exec(`ALTER TABLE instances ADD CONSTRAINT fk_instances_user FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;`)
// }
