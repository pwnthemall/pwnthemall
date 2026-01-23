package controllers

import (
	"github.com/gin-gonic/gin"
	"github.com/pwnthemall/pwnthemall/backend/config"
	"github.com/pwnthemall/pwnthemall/backend/dto"
	"github.com/pwnthemall/pwnthemall/backend/models"
	"github.com/pwnthemall/pwnthemall/backend/utils"
	"gorm.io/gorm"
)

// GetFeaturedChallengeConfig returns the current featured challenge configuration
func GetFeaturedChallengeConfig(c *gin.Context) {
	var featuredConfig models.FeaturedChallengeConfig
	
	// Get the first (and should be only) config
	result := config.DB.First(&featuredConfig)
	
	// If no config exists, return default
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			utils.OKResponse(c, models.FeaturedChallengeConfig{
				Mode:         "highest_points",
				ChallengeIDs: []int64{},
			})
			return
		}
		utils.InternalServerError(c, result.Error.Error())
		return
	}
	
	utils.OKResponse(c, featuredConfig)
}

// UpdateFeaturedChallengeConfig updates the featured challenge configuration
func UpdateFeaturedChallengeConfig(c *gin.Context) {
	var input struct {
		Mode         string   `json:"mode" binding:"required,oneof=manual most_solved highest_points active_first_blood"`
		ChallengeIDs []int64  `json:"challengeIds"`
	}
	
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.BadRequestError(c, err.Error())
		return
	}
	
	// Validate that if mode is manual, challengeIds must be provided
	if input.Mode == "manual" && len(input.ChallengeIDs) == 0 {
		utils.BadRequestError(c, "Manual mode requires at least one challenge ID")
		return
	}
	
	// Get existing config or create new one
	var featuredConfig models.FeaturedChallengeConfig
	result := config.DB.First(&featuredConfig)
	
	if result.Error != nil && result.Error != gorm.ErrRecordNotFound {
		utils.InternalServerError(c, result.Error.Error())
		return
	}
	
	// Update or create
	featuredConfig.Mode = input.Mode
	featuredConfig.ChallengeIDs = input.ChallengeIDs
	
	if result.Error == gorm.ErrRecordNotFound {
		// Create new
		if err := config.DB.Create(&featuredConfig).Error; err != nil {
			utils.InternalServerError(c, err.Error())
			return
		}
	} else {
		// Update existing
		if err := config.DB.Save(&featuredConfig).Error; err != nil {
			utils.InternalServerError(c, err.Error())
			return
		}
	}
	
	utils.OKResponse(c, featuredConfig)
}

// GetFeaturedChallenges returns the 3 featured challenges based on the current configuration
func GetFeaturedChallenges(c *gin.Context) {
	var featuredConfig models.FeaturedChallengeConfig
	
	// Get the config
	result := config.DB.First(&featuredConfig)
	if result.Error != nil && result.Error != gorm.ErrRecordNotFound {
		utils.InternalServerError(c, result.Error.Error())
		return
	}
	
	// Default to highest_points if no config
	mode := "highest_points"
	if result.Error == nil {
		mode = featuredConfig.Mode
	}
	
	var challenges []models.Challenge
	
	switch mode {
	case "manual":
		// Get specific challenges by IDs, limited to 3
		if len(featuredConfig.ChallengeIDs) > 0 {
			ids := featuredConfig.ChallengeIDs
			if len(ids) > 3 {
				ids = ids[:3]
			}
			config.DB.Where("id IN ? AND hidden = ?", ids, false).
				Preload("ChallengeCategory").
				Preload("ChallengeDifficulty").
				Preload("ChallengeType").
				Preload("DecayFormula").
				Find(&challenges)
			
			// Sort by the order in ChallengeIDs
			sortedChallenges := make([]models.Challenge, 0, len(ids))
			for _, id := range ids {
				for _, ch := range challenges {
					if ch.ID == uint(id) {
						sortedChallenges = append(sortedChallenges, ch)
						break
					}
				}
			}
			challenges = sortedChallenges
		}
		
	case "highest_points":
		// Get challenges with highest points
		config.DB.Where("hidden = ?", false).
			Preload("ChallengeCategory").
			Preload("ChallengeDifficulty").
			Preload("ChallengeType").
			Preload("DecayFormula").
			Order("points DESC").
			Limit(3).
			Find(&challenges)
			
	case "active_first_blood":
		// Get challenges that have first blood enabled and no first blood yet
		config.DB.Where("hidden = ? AND enable_first_blood = ?", false, true).
			Preload("ChallengeCategory").
			Preload("ChallengeDifficulty").
			Preload("ChallengeType").
			Preload("DecayFormula").
			Preload("FirstBlood").
			Order("points DESC").
			Find(&challenges)
		
		// Filter out those that already have first blood
		filteredChallenges := make([]models.Challenge, 0)
		for _, ch := range challenges {
			if ch.FirstBlood == nil {
				filteredChallenges = append(filteredChallenges, ch)
				if len(filteredChallenges) >= 3 {
					break
				}
			}
		}
		challenges = filteredChallenges
		
	default: // "most_solved"
		// Get most solved challenges
		var challengeStats []struct {
			ChallengeID uint
			SolveCount  int64
		}
		
		config.DB.Table("solves").
			Select("challenge_id, COUNT(*) as solve_count").
			Group("challenge_id").
			Order("solve_count DESC").
			Limit(3).
			Find(&challengeStats)
		
		if len(challengeStats) > 0 {
			challengeIDs := make([]uint, len(challengeStats))
			for i, stat := range challengeStats {
				challengeIDs[i] = stat.ChallengeID
			}
			
			config.DB.Where("id IN ? AND hidden = ?", challengeIDs, false).
				Preload("ChallengeCategory").
				Preload("ChallengeDifficulty").
				Preload("ChallengeType").
				Preload("DecayFormula").
				Find(&challenges)
			
			// Sort by solve count
			sortedChallenges := make([]models.Challenge, 0, len(challengeIDs))
			for _, stat := range challengeStats {
				for _, ch := range challenges {
					if ch.ID == stat.ChallengeID {
						sortedChallenges = append(sortedChallenges, ch)
						break
					}
				}
			}
			challenges = sortedChallenges
		}
	}
	
	// Get user and team info
	user, _ := c.Get("user")
	userModel, _ := user.(models.User)
	
	// Get solved challenge IDs for the user's team
	var solvedChallengeIds []uint
	if userModel.TeamID != nil {
		var solves []models.Solve
		config.DB.Where("team_id = ?", *userModel.TeamID).Find(&solves)
		for _, solve := range solves {
			solvedChallengeIds = append(solvedChallengeIds, solve.ChallengeID)
		}
	}
	
	// Get purchased hint IDs for the user's team
	var purchasedHintIds []uint
	if userModel.TeamID != nil {
		var hintPurchases []models.HintPurchase
		config.DB.Where("team_id = ?", *userModel.TeamID).Find(&hintPurchases)
		for _, purchase := range hintPurchases {
			purchasedHintIds = append(purchasedHintIds, purchase.HintID)
		}
	}
	
	// Get failed attempts count
	var failedAttemptsMap map[uint]int64
	if userModel.TeamID != nil {
		var attempts []struct {
			ChallengeID uint
			Count       int64
		}
		config.DB.Table("submissions").
			Select("challenge_id, COUNT(*) as count").
			Where("team_id = ? AND correct = ?", *userModel.TeamID, false).
			Group("challenge_id").
			Find(&attempts)
		
		failedAttemptsMap = make(map[uint]int64)
		for _, att := range attempts {
			failedAttemptsMap[att.ChallengeID] = att.Count
		}
	} else {
		failedAttemptsMap = make(map[uint]int64)
	}
	
	// Build response with solved status
	var challengesWithSolved []dto.ChallengeWithSolved
	decayService := utils.NewDecay()
	
	for _, challenge := range challenges {
		// Admins see all challenges, skip dependency check for featured
		item := buildChallengeWithSolved(challenge, solvedChallengeIds, purchasedHintIds, failedAttemptsMap, userModel.Role, decayService)
		challengesWithSolved = append(challengesWithSolved, item)
	}
	
	utils.OKResponse(c, challengesWithSolved)
}
