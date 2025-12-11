package config

import (
	"fmt"
	"math/rand"
	"os"
	"strconv"
	"time"

	"github.com/casbin/casbin/v2"
	"github.com/pwnthemall/pwnthemall/backend/debug"
	"github.com/pwnthemall/pwnthemall/backend/models"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Constants for demo data queries
const (
	queryDemoTeamPattern = "Demo Team %"
	queryNameLike        = "name LIKE ?"
	queryTeamIDIn        = "team_id IN ?"
	queryDemoUserPattern = "demo-user-%"
)

// getEnvWithDefault returns the environment variable value or a default if not set
func getEnvWithDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// CTFStatus represents the current status of the CTF
type CTFStatus string

const (
	CTFNotStarted CTFStatus = "not_started"
	CTFActive     CTFStatus = "active"
	CTFEnded      CTFStatus = "ended"
	CTFNoTiming   CTFStatus = "no_timing" // When no start/end times are configured
)

// GetCTFStatus returns the current status of the CTF based on start and end times
func GetCTFStatus() CTFStatus {
	var startConfig, endConfig models.Config

	// Get start time - create if missing
	if err := DB.Where("key = ?", "CTF_START_TIME").First(&startConfig).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			// Create missing CTF_START_TIME config
			startConfig = models.Config{
				Key:    "CTF_START_TIME",
				Value:  getEnvWithDefault("PTA_CTF_START_TIME", ""),
				Public: true,
			}
			if createErr := DB.Create(&startConfig).Error; createErr != nil {
				debug.Log("Failed to create CTF_START_TIME config: %v", createErr)
				return CTFNoTiming
			}
		} else {
			debug.Log("Database error getting CTF_START_TIME: %v", err)
			return CTFNoTiming
		}
	}

	// Get end time - create if missing
	if err := DB.Where("key = ?", "CTF_END_TIME").First(&endConfig).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			// Create missing CTF_END_TIME config
			endConfig = models.Config{
				Key:    "CTF_END_TIME",
				Value:  getEnvWithDefault("PTA_CTF_END_TIME", ""),
				Public: true,
			}
			if createErr := DB.Create(&endConfig).Error; createErr != nil {
				debug.Log("Failed to create CTF_END_TIME config: %v", createErr)
				return CTFNoTiming
			}
		} else {
			debug.Log("Database error getting CTF_END_TIME: %v", err)
			return CTFNoTiming
		}
	}

	// If either time is empty, no timing is configured
	if startConfig.Value == "" || endConfig.Value == "" {
		return CTFNoTiming
	}

	// Parse times (expecting RFC3339 format: 2006-01-02T15:04:05Z07:00)
	startTime, err := time.Parse(time.RFC3339, startConfig.Value)
	if err != nil {
		debug.Log("Failed to parse CTF start time")
		return CTFNoTiming
	}

	endTime, err := time.Parse(time.RFC3339, endConfig.Value)
	if err != nil {
		debug.Log("Failed to parse CTF end time: %v", err)
		return CTFNoTiming
	}

	now := time.Now()

	if now.Before(startTime) {
		return CTFNotStarted
	} else if now.After(endTime) {
		return CTFEnded
	} else {
		return CTFActive
	}
}

// IsCTFActive returns true if the CTF is currently active
func IsCTFActive() bool {
	status := GetCTFStatus()
	return status == CTFActive || status == CTFNoTiming
}

// IsCTFStarted returns true if the CTF has started (active or ended)
func IsCTFStarted() bool {
	status := GetCTFStatus()
	return status == CTFActive || status == CTFEnded || status == CTFNoTiming
}

func seedConfig() {
	config := []models.Config{
		{Key: "SITE_NAME", Value: os.Getenv("PTA_SITE_NAME"), Public: true},
		{Key: "REGISTRATION_ENABLED", Value: getEnvWithDefault("PTA_REGISTRATION_ENABLED", "false"), Public: true},
		{Key: "CTF_START_TIME", Value: getEnvWithDefault("PTA_CTF_START_TIME", ""), Public: true},
		{Key: "CTF_END_TIME", Value: getEnvWithDefault("PTA_CTF_END_TIME", ""), Public: true},
	}

	for _, item := range config {
		var existing models.Config
		err := DB.Where("key = ?", item.Key).First(&existing).Error
		if err != nil && err != gorm.ErrRecordNotFound {
			continue
		}
		if err == nil {
			continue
		}
		if err := DB.Create(&item).Error; err != nil {
			debug.Log("Failed to seed config %s: %v\n", item.Key, err)
		}
	}
	debug.Println("Seeding: config finished")
}

func seedDockerConfig() {
	var existing models.DockerConfig
	err := DB.First(&existing).Error
	if err == nil {
		debug.Println("Seeding: docker config already exists, skipping")
		return
	}

	iByTeam, err := strconv.Atoi(os.Getenv("PTA_DOCKER_INSTANCES_BY_TEAM"))
	if err != nil {
		iByTeam = 15
	}

	iByUser, err := strconv.Atoi(os.Getenv("PTA_DOCKER_INSTANCES_BY_USER"))
	if err != nil {
		iByUser = 5
	}

	maxMem, err := strconv.Atoi(os.Getenv("PTA_DOCKER_MAXMEM_PER_INSTANCE"))
	if err != nil {
		maxMem = 256
	}

	maxCpu, err := strconv.ParseFloat(os.Getenv("PTA_DOCKER_MAXCPU_PER_INSTANCE"), 64)
	if err != nil {
		maxCpu = 0.01
	}

	instanceTimeout, err := strconv.Atoi(os.Getenv("PTA_DOCKER_INSTANCE_TIMEOUT"))
	if err != nil {
		instanceTimeout = 60 // Default 60 minutes
	}

	// Cooldown seconds between stop and next start for same team/challenge
	cooldownEnv := getEnvWithDefault("PTA_DOCKER_INSTANCE_COOLDOWN_SECONDS", "0")
	cooldownSeconds, err := strconv.Atoi(cooldownEnv)
	if err != nil {
		cooldownSeconds = 0 // Disabled by default
	}

	config := models.DockerConfig{
		Host:                    os.Getenv("PTA_DOCKER_WORKER_URL"),
		ImagePrefix:             os.Getenv("PTA_DOCKER_IMAGE_PREFIX"),
		MaxMemByInstance:        maxMem,
		MaxCpuByInstance:        maxCpu,
		InstancesByTeam:         iByTeam,
		InstancesByUser:         iByUser,
		InstanceTimeout:         instanceTimeout,
		InstanceCooldownSeconds: cooldownSeconds,
	}

	if err := DB.Create(&config).Error; err != nil {
		debug.Log("Failed to seed docker config: %s", err.Error())
		return
	}
	debug.Println("Seeding: docker config finished")
}

func seedChallengeCategory() {
	challengeCategories := []models.ChallengeCategory{
		{Name: "pwn"},
		{Name: "misc"},
	}
	for _, challengeCategory := range challengeCategories {
		var existing models.ChallengeCategory
		err := DB.Where("name = ?", challengeCategory.Name).First(&existing).Error
		if err != nil && err != gorm.ErrRecordNotFound {
			debug.Log("Failed to check challengeCategory %s: %v\n", challengeCategory.Name, err)
			continue
		}
		if err == nil {
			continue
		}
		if err := DB.Create(&challengeCategory).Error; err != nil {
			debug.Log("Failed to seed challengeCategory %s: %v\n", challengeCategory.Name, err)
		}
	}
	debug.Println("Seeding: challengeCategories finished")
}

func seedChallengeType() {
	challengeTypes := []models.ChallengeType{
		{Name: "standard"},
		{Name: "docker", Instance: true},
		{Name: "compose", Instance: true},
		{Name: "geo"},
	}
	for _, challengeType := range challengeTypes {
		var existing models.ChallengeType
		err := DB.Where("name = ?", challengeType.Name).First(&existing).Error
		if err != nil && err != gorm.ErrRecordNotFound {
			debug.Log("Failed to check challengeType %s: %v\n", challengeType.Name, err)
			continue
		}
		if err == nil {
			continue
		}
		if err := DB.Create(&challengeType).Error; err != nil {
			debug.Log("Failed to seed challengeType %s: %v\n", challengeType.Name, err)
		}
	}
	debug.Println("Seeding: challengeTypes finished")
}

func seedChallengeDifficulty() {
	challengeDifficulties := []models.ChallengeDifficulty{
		{Name: "intro"},
		{Name: "easy"},
		{Name: "medium"},
		{Name: "hard"},
		{Name: "insane"},
	}
	for _, challengeDifficulty := range challengeDifficulties {
		var existing models.ChallengeDifficulty
		err := DB.Where("name = ?", challengeDifficulty.Name).First(&existing).Error
		if err != nil && err != gorm.ErrRecordNotFound {
			debug.Log("Failed to check challengeDifficulty %s: %v\n", challengeDifficulty.Name, err)
			continue
		}
		if err == nil {
			continue
		}
		if err := DB.Create(&challengeDifficulty).Error; err != nil {
			debug.Log("Failed to seed challengeDifficulty %s: %v\n", challengeDifficulty.Name, err)
		}
	}
	debug.Println("Seeding: challengeTypes finished")
}

func seedDecayFormulas() {
	decayFormulas := []models.DecayFormula{
		{
			Name:      "No Decay",
			Type:      "fixed",
			Step:      0,
			MinPoints: 0,
		},
		{
			Name:      "Logarithmic - Slow",
			Type:      "logarithmic",
			Step:      50,
			MinPoints: 100,
		},
		{
			Name:      "Logarithmic - Medium",
			Type:      "logarithmic",
			Step:      75,
			MinPoints: 75,
		},
		{
			Name:      "Logarithmic - Fast",
			Type:      "logarithmic",
			Step:      100,
			MinPoints: 50,
		},
		{
			Name:      "Logarithmic - Very Slow",
			Type:      "logarithmic",
			Step:      25,
			MinPoints: 25,
		},
		{
			Name:      "Logarithmic - Ultra Slow",
			Type:      "logarithmic",
			Step:      10,
			MinPoints: 10,
		},
	}

	for _, formula := range decayFormulas {
		var existing models.DecayFormula
		err := DB.Where("name = ?", formula.Name).First(&existing).Error
		if err != nil && err != gorm.ErrRecordNotFound {
			debug.Log("Failed to check decay formula %s: %v\n", formula.Name, err)
			continue
		}
		if err == nil {
			continue
		}
		if err := DB.Create(&formula).Error; err != nil {
			debug.Log("Failed to seed decay formula %s: %v\n", formula.Name, err)
		}
	}
	debug.Println("Seeding: decay formulas finished")
}

func seedDefaultUsers() {
	users := []models.User{
		{Username: "admin", Email: "admin@admin.admin", Password: "admin", Role: "admin"},
		{Username: "user", Email: "user@user.user", Password: "user", Role: "member"},
		{Username: "user1", Email: "user1@user.user", Password: "user1", Role: "member"},
		{Username: "user2", Email: "user2@user.user", Password: "user2", Role: "member"},
		{Username: "user3", Email: "user3@user.user", Password: "user3", Role: "member"},
		{Username: "user4", Email: "user4@user.user", Password: "user4", Role: "member"},
		{Username: "user5", Email: "user5@user.user", Password: "user5", Role: "member"},
	}

	for _, user := range users {
		var existing models.User
		err := DB.Where("username = ? OR email = ?", user.Username, user.Email).First(&existing).Error
		if err != nil && err != gorm.ErrRecordNotFound {
			debug.Log("Failed to check user %s: %v\n", user.Username, err)
			continue
		}
		if err == nil {
			continue // user already exists
		}

		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
		if err != nil {
			debug.Log("Failed to hash password for user %s: %v\n", user.Username, err)
			continue
		}
		user.Password = string(hashedPassword)
		if err := DB.Create(&user).Error; err != nil {
			debug.Log("Failed to seed user %s: %v\n", user.Username, err)
		}
	}
	debug.Println("Seeding: users finished")
}

func SeedCasbin(enforcer *casbin.Enforcer) {
	debug.Println("Seeding: Casbin rules..")
	if hasPolicy, _ := enforcer.HasPolicy("anonymous", "/login", "*"); !hasPolicy {
		enforcer.AddPolicy("anonymous", "/login", "*")
	}
	if hasPolicy, _ := enforcer.HasPolicy("anonymous", "/register", "*"); !hasPolicy {
		enforcer.AddPolicy("anonymous", "/register", "*")
	}

	if hasPolicy, _ := enforcer.HasPolicy("member", "/pwn", "*"); !hasPolicy {
		enforcer.AddPolicy("member", "/pwn", "*")
	}
	if hasPolicy, _ := enforcer.HasPolicy("member", "/logout", "*"); !hasPolicy {
		enforcer.AddPolicy("member", "/logout", "*")
	}

	if hasPolicy, _ := enforcer.HasPolicy("admin", "/*", "*"); !hasPolicy {
		enforcer.AddPolicy("admin", "/*", "*")
	}
	enforcer.SavePolicy()
	debug.Println("Seeding: Casbin finished")

}

func SeedCasbinFromCsv(enforcer *casbin.Enforcer) {
	debug.Println("Seeding: Casbin rules from CSV..")
	e, err := casbin.NewEnforcer("config/casbin_model.conf", "config/casbin_policies.csv")
	if err != nil {
		debug.Println(err.Error())
	}
	e.LoadPolicy()
	e.SetAdapter(enforcer.GetAdapter())
	e.SavePolicy()
	debug.Println("Seeding: Casbin from CSV finished")
}

func SeedDatabase() {
	debug.Println("Seeding: Database..")
	seedConfig()
	seedDockerConfig()
	seedChallengeDifficulty()
	seedChallengeCategory()
	seedChallengeType()
	seedDecayFormulas()
	seedDefaultUsers()

}

// SeedDemoData creates demo teams, users, and solves with timestamps spread over a time range
// This is useful for testing the scoreboard timeline without using Playwright tests
func SeedDemoData(teamCount int, timeRangeHours int) error {
	debug.Log("Seeding: Demo data with %d teams over %d hours...\n", teamCount, timeRangeHours)

	// Check if challenges exist
	var challengeCount int64
	if err := DB.Model(&models.Challenge{}).Where("hidden = ?", false).Count(&challengeCount).Error; err != nil {
		return fmt.Errorf("failed to count challenges: %w", err)
	}
	if challengeCount == 0 {
		return fmt.Errorf("no challenges found - please sync challenges from MinIO first")
	}
	debug.Log("Found %d challenges to use for demo data\n", challengeCount)

	// Get all visible challenges
	var challenges []models.Challenge
	if err := DB.Preload("DecayFormula").Preload("Flags").Where("hidden = ?", false).Find(&challenges).Error; err != nil {
		return fmt.Errorf("failed to fetch challenges: %w", err)
	}

	// Check for existing demo data
	var existingDemoTeams int64
	if err := DB.Model(&models.Team{}).Where(queryNameLike, queryDemoTeamPattern).Count(&existingDemoTeams).Error; err != nil {
		return fmt.Errorf("failed to check existing demo teams: %w", err)
	}
	if existingDemoTeams > 0 {
		debug.Log("Found %d existing demo teams - skipping creation (use clean-demo first)\n", existingDemoTeams)
		return nil
	}

	// Calculate time range
	now := time.Now()
	startTime := now.Add(-time.Duration(timeRangeHours) * time.Hour)
	timeRange := now.Sub(startTime)

	// Create teams and users
	var createdTeams []models.Team
	demoPassword := "demo123"
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(demoPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash demo password: %w", err)
	}

	for i := 1; i <= teamCount; i++ {
		// Create user first
		user := models.User{
			Username: fmt.Sprintf("demo-user-%d", i),
			Email:    fmt.Sprintf("demo%d@demo.local", i),
			Password: string(hashedPassword),
			Role:     "member",
		}
		if err := DB.Create(&user).Error; err != nil {
			debug.Log("Failed to create demo user %d: %v\n", i, err)
			continue
		}

		// Create team
		team := models.Team{
			Name:      fmt.Sprintf("Demo Team %d", i),
			Password:  string(hashedPassword),
			CreatorID: user.ID,
		}
		if err := DB.Create(&team).Error; err != nil {
			debug.Log("Failed to create demo team %d: %v\n", i, err)
			continue
		}

		// Assign user to team
		user.TeamID = &team.ID
		if err := DB.Save(&user).Error; err != nil {
			debug.Log("Failed to assign user to team %d: %v\n", i, err)
			continue
		}

		createdTeams = append(createdTeams, team)
		debug.Log("Created Demo Team %d with user demo-user-%d\n", i, i)
	}

	// Create solves with spread timestamps
	totalSolves := 0
	challengeFirstBlood := make(map[uint]int) // Track first blood position per challenge

	for _, team := range createdTeams {
		// Each team solves 1-5 random challenges
		solvesCount := 1 + (int(team.ID) % 5) // Deterministic but varied: 1-5 solves

		// Get team's user
		var user models.User
		if err := DB.Where("team_id = ?", team.ID).First(&user).Error; err != nil {
			debug.Log("Failed to find user for team %d: %v\n", team.ID, err)
			continue
		}

		// Shuffle challenges for this team (using team ID as seed for determinism)
		teamChallenges := make([]models.Challenge, len(challenges))
		copy(teamChallenges, challenges)
		shuffleChallenges(teamChallenges, int64(team.ID))

		for j := 0; j < solvesCount && j < len(teamChallenges); j++ {
			challenge := teamChallenges[j]

			// Check if team already solved this challenge
			var existingSolve models.Solve
			result := DB.Session(&gorm.Session{Logger: DB.Logger.LogMode(logger.Silent)}).
				Where("team_id = ? AND challenge_id = ?", team.ID, challenge.ID).First(&existingSolve)
			if result.Error == nil {
				continue // Already solved
			}

			// Generate random timestamp within the time range
			randomOffset := time.Duration(rand.Int63n(int64(timeRange)))
			solveTime := startTime.Add(randomOffset)

			// Get solve position for this challenge
			position := challengeFirstBlood[challenge.ID]
			challengeFirstBlood[challenge.ID]++

			// Calculate points based on position
			basePoints := challenge.Points
			if challenge.DecayFormula != nil && challenge.DecayFormula.Type == "logarithmic" {
				// Simple decay calculation
				if position > 0 {
					decayFactor := 1.0 - (float64(position) * float64(challenge.DecayFormula.Step) / 1000.0)
					if decayFactor < float64(challenge.DecayFormula.MinPoints)/float64(basePoints) {
						decayFactor = float64(challenge.DecayFormula.MinPoints) / float64(basePoints)
					}
					basePoints = int(float64(basePoints) * decayFactor)
				}
			}

			// Add first blood bonus if applicable
			if challenge.EnableFirstBlood && position < len(challenge.FirstBloodBonuses) {
				basePoints += int(challenge.FirstBloodBonuses[position])
			}

			// Create solve entry
			solve := models.Solve{
				TeamID:      team.ID,
				ChallengeID: challenge.ID,
				UserID:      user.ID,
				Points:      basePoints,
				SolvedBy:    user.Username,
			}

			// Set CreatedAt manually for the spread effect
			if err := DB.Create(&solve).Error; err != nil {
				debug.Log("Failed to create solve for team %d, challenge %d: %v\n", team.ID, challenge.ID, err)
				continue
			}

			// Update the timestamp directly (GORM auto-sets CreatedAt)
			if err := DB.Model(&solve).Update("created_at", solveTime).Error; err != nil {
				debug.Log("Failed to update solve timestamp: %v\n", err)
			}

			// Create first blood entry if applicable
			if challenge.EnableFirstBlood && position < len(challenge.FirstBloodBonuses) {
				badge := "trophy"
				if position < len(challenge.FirstBloodBadges) {
					badge = challenge.FirstBloodBadges[position]
				}
				firstBlood := models.FirstBlood{
					ChallengeID: challenge.ID,
					TeamID:      team.ID,
					UserID:      user.ID,
					Bonuses:     []int64{challenge.FirstBloodBonuses[position]},
					Badges:      []string{badge},
				}
				DB.Create(&firstBlood)
			}

			totalSolves++
		}
	}

	debug.Log("Seeding: Demo data complete - created %d teams and %d solves\n", len(createdTeams), totalSolves)
	debug.Log("Solve timestamps spread from %s to %s\n", startTime.Format(time.RFC3339), now.Format(time.RFC3339))
	return nil
}

// CleanDemoData removes all demo teams, users, and their associated data
func CleanDemoData() error {
	debug.Println("Cleaning: Demo data...")

	// Get demo team IDs
	var demoTeams []models.Team
	if err := DB.Where(queryNameLike, queryDemoTeamPattern).Find(&demoTeams).Error; err != nil {
		return fmt.Errorf("failed to find demo teams: %w", err)
	}

	if len(demoTeams) == 0 {
		debug.Println("No demo teams found to clean")
		return nil
	}

	teamIDs := make([]uint, len(demoTeams))
	for i, team := range demoTeams {
		teamIDs[i] = team.ID
	}

	// Delete solves for demo teams
	if err := DB.Where(queryTeamIDIn, teamIDs).Delete(&models.Solve{}).Error; err != nil {
		debug.Log("Failed to delete demo solves: %v\n", err)
	}

	// Delete first bloods for demo teams
	if err := DB.Where(queryTeamIDIn, teamIDs).Delete(&models.FirstBlood{}).Error; err != nil {
		debug.Log("Failed to delete demo first bloods: %v\n", err)
	}

	// Delete hint purchases for demo teams
	if err := DB.Where(queryTeamIDIn, teamIDs).Delete(&models.HintPurchase{}).Error; err != nil {
		debug.Log("Failed to delete demo hint purchases: %v\n", err)
	}

	// Delete demo users
	if err := DB.Where("username LIKE ?", queryDemoUserPattern).Delete(&models.User{}).Error; err != nil {
		debug.Log("Failed to delete demo users: %v\n", err)
	}

	// Delete demo teams
	if err := DB.Where(queryNameLike, queryDemoTeamPattern).Delete(&models.Team{}).Error; err != nil {
		return fmt.Errorf("failed to delete demo teams: %w", err)
	}

	debug.Log("Cleaning: Removed %d demo teams and associated data\n", len(demoTeams))
	return nil
}

func shuffleChallenges(challenges []models.Challenge, seed int64) {
	r := rand.New(rand.NewSource(seed))
	for i := len(challenges) - 1; i > 0; i-- {
		j := r.Intn(i + 1)
		challenges[i], challenges[j] = challenges[j], challenges[i]
	}
}
