package controllers

import (
	"encoding/json"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jinzhu/copier"
	"github.com/pwnthemall/pwnthemall/backend/config"
	"github.com/pwnthemall/pwnthemall/backend/dto"
	"github.com/pwnthemall/pwnthemall/backend/models"
	"github.com/pwnthemall/pwnthemall/backend/utils"
	"golang.org/x/crypto/bcrypt"
)

// Add this struct for input validation

func GetUsers(c *gin.Context) {
	var users []models.User
	result := config.DB.Preload("Team").Find(&users)
	if result.Error != nil {
		utils.InternalServerError(c, result.Error.Error())
		return
	}
	utils.OKResponse(c, users)
}

func GetUser(c *gin.Context) {
	var user models.User
	id := c.Param("id")

	result := config.DB.First(&user, id)
	if result.Error != nil {
		utils.NotFoundError(c, "User not found")
		return
	}
	utils.OKResponse(c, user)
}

func CreateUser(c *gin.Context) {
	var input dto.UserInput
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.BadRequestError(c, "Username (max 32), email (max 254), password (8-72) invalid: "+err.Error())
		return
	}

	// Validate username for malicious characters
	if errKey := utils.ValidateUsername(input.Username); errKey != "" {
		utils.BadRequestError(c, errKey)
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		utils.InternalServerError(c, "Internal server error")
		return
	}

	var user models.User
	copier.Copy(&user, &input)
	user.Password = string(hashedPassword)
	if user.Role == "" {
		user.Role = "member"
	}

	if err := config.DB.Create(&user).Error; err != nil {
		utils.InternalServerError(c, err.Error())
		return
	}

	// Ne retourne jamais le mot de passe dans la réponse
	utils.CreatedResponse(c, gin.H{
		"id":       user.ID,
		"username": user.Username,
		"email":    user.Email,
	})
}

func UpdateUser(c *gin.Context) {
	var user models.User
	id := c.Param("id")

	if err := config.DB.First(&user, id).Error; err != nil {
		utils.NotFoundError(c, "User not found")
		return
	}

	var input dto.UserInput
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.BadRequestError(c, "Username (max 32), email (max 254) or password invalid: "+err.Error())
		return
	}

	// Validate username for malicious characters
	if errKey := utils.ValidateUsername(input.Username); errKey != "" {
		utils.BadRequestError(c, errKey)
		return
	}

	user.Username = input.Username
	user.Email = input.Email
	user.Role = input.Role
	// Update password only if provided, and hash it
	if strings.TrimSpace(input.Password) != "" {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
		if err != nil {
			utils.InternalServerError(c, "Internal server error")
			return
		}
		user.Password = string(hashedPassword)
	}
	config.DB.Save(&user)

	utils.OKResponse(c, user)
}

func DeleteUser(c *gin.Context) {
	var user models.User
	id := c.Param("id")

	if err := config.DB.First(&user, id).Error; err != nil {
		utils.NotFoundError(c, "User not found")
		return
	}

	config.DB.Delete(&user)
	utils.OKResponse(c, gin.H{"message": "User deleted"})
}

// GetCurrentUser returns the currently authenticated user based on the session
func GetCurrentUser(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		utils.UnauthorizedError(c, "unauthorized")
		return
	}

	var user models.User
	if err := config.DB.Preload("Team.Creator").Preload("Team").First(&user, userID).Error; err != nil {
		utils.NotFoundError(c, "User not found")
		return
	}

	var safeMembers []dto.SafeUser
	if user.TeamID != nil {
		var members []models.User
		if err := config.DB.Where("team_id = ?", user.TeamID).Find(&members).Error; err == nil {
			safeMembers = make([]dto.SafeUser, len(members))
			copier.Copy(&safeMembers, &members)
		}
	}

	// Compute team-based points and number of solved challenges
	var totalPoints int = 0
	var solvesCount int64 = 0
	if user.TeamID != nil {
		// Count of solves for the team
		config.DB.Model(&models.Solve{}).Where("team_id = ?", *user.TeamID).Count(&solvesCount)
		// Calculate current points with decay
		decayService := utils.NewDecay()
		score, _, err := calculateTeamScore(*user.TeamID, decayService)
		if err == nil {
			totalPoints = score
		}
	}

	// Compute total number of challenges available to solve (challenges with at least one flag)
	var totalChallenges int64 = 0
	if user.Role == "admin" {
		// Admins: all challenges that have at least one flag
		config.DB.
			Model(&models.Flag{}).
			Select("DISTINCT challenge_id").
			Count(&totalChallenges)
	} else {
		// Members: only non-hidden challenges that have at least one flag
		config.DB.
			Table("flags").
			Joins("JOIN challenges ON challenges.id = flags.challenge_id").
			Where("challenges.hidden = ?", false).
			Select("DISTINCT flags.challenge_id").
			Count(&totalChallenges)
	}

	response := gin.H{
		"id":                  user.ID,
		"username":            user.Username,
		"email":               user.Email,
		"role":                user.Role,
		"banned":              user.Banned,
		"teamId":              user.TeamID,
		"memberSince":         user.MemberSince,
		"team":                gin.H{},
		"points":              totalPoints,
		"challengesCompleted": solvesCount,
		"totalChallenges":     totalChallenges,
	}

	if user.Team != nil {
		response["team"] = gin.H{
			"id":        user.Team.ID,
			"name":      user.Team.Name,
			"creatorId": user.Team.CreatorID,
			"members":   safeMembers,
		}
	}

	utils.OKResponse(c, response)
}

func BanOrUnbanUser(c *gin.Context) {
	var user models.User
	id := c.Param("id")

	if err := config.DB.First(&user, id).Error; err != nil {
		utils.NotFoundError(c, "user not found")
		return
	}

	user.Banned = !user.Banned
	config.DB.Save(&user)

	// Broadcast ban event to the specific user via WebSocket
	if user.Banned && utils.UpdatesHub != nil {
		payload, _ := json.Marshal(gin.H{
			"event":   "user-banned",
			"user_id": user.ID,
		})
		utils.UpdatesHub.SendToUser(user.ID, payload)
	}

	utils.OKResponse(c, gin.H{"banned": user.Banned})
}

// GetUserByIP searches for users by IP address (admin only)
func GetUserByIP(c *gin.Context) {
	ip := c.Query("ip")
	if ip == "" {
		utils.BadRequestError(c, "IP address is required")
		return
	}

	var users []models.User
	// Search for users whose IP addresses contain the specified IP
	// Using JSON_EXTRACT or JSON_SEARCH for MySQL/SQLite compatibility
	result := config.DB.Preload("Team").Where("ip_addresses LIKE ?", "%\""+ip+"\"%").Find(&users)

	if result.Error != nil {
		utils.InternalServerError(c, "Failed to search users by IP")
		return
	}

	// Filter results to ensure exact IP match (since LIKE might have false positives)
	var filteredUsers []models.User
	for _, user := range users {
		for _, userIP := range user.IPAddresses {
			if userIP == ip {
				filteredUsers = append(filteredUsers, user)
				break
			}
		}
	}

	utils.OKResponse(c, filteredUsers)
}

// GetIndividualLeaderboard returns individual user rankings based on points from solves they submitted
// Each user's score is the sum of points from solves where they were the submitter
func GetIndividualLeaderboard(c *gin.Context) {
	// Query to aggregate scores by user
	// We use the stored Points value in each Solve record (already includes decay and first blood bonuses)
	type userScore struct {
		UserID     uint
		TotalScore int
		SolveCount int64
	}

	var scores []userScore
	if err := config.DB.Model(&models.Solve{}).
		Select("user_id, COALESCE(SUM(points), 0) as total_score, COUNT(*) as solve_count").
		Group("user_id").
		Order("total_score DESC").
		Scan(&scores).Error; err != nil {
		utils.InternalServerError(c, "failed_to_fetch_individual_scores")
		return
	}

	// Build leaderboard with user details
	var leaderboard []dto.IndividualScore
	for _, score := range scores {
		var user models.User
		if err := config.DB.Preload("Team").First(&user, score.UserID).Error; err != nil {
			continue
		}

		teamName := ""
		if user.Team != nil {
			teamName = user.Team.Name
		}
		var safeUser dto.SafeUser
		copier.Copy(&safeUser, &user)

		leaderboard = append(leaderboard, dto.IndividualScore{
			User:       safeUser,
			TeamName:   teamName,
			TotalScore: score.TotalScore,
			SolveCount: int(score.SolveCount),
		})
	}

	utils.OKResponse(c, leaderboard)
}

// individualTimelinePoint represents a point in the individual user timeline
type individualTimelinePoint struct {
	Time   string         `json:"time"`
	Scores map[string]int `json:"scores"` // username -> score
}

// individualInfo holds user metadata for the timeline response
type individualInfo struct {
	ID       uint   `json:"id"`
	Username string `json:"username"`
	Color    string `json:"color"`
}

// individualTimelineResponse is the response for the individual timeline endpoint
type individualTimelineResponse struct {
	Users    []individualInfo          `json:"users"`
	Timeline []individualTimelinePoint `json:"timeline"`
}

// GetIndividualTimeline returns solve activity timeline for top individual users
func GetIndividualTimeline(c *gin.Context) {
	// First, get top 10 users by total score
	type userScore struct {
		UserID     uint
		TotalScore int
	}

	var topScores []userScore
	if err := config.DB.Model(&models.Solve{}).
		Select("user_id, COALESCE(SUM(points), 0) as total_score").
		Group("user_id").
		Order("total_score DESC").
		Limit(10).
		Scan(&topScores).Error; err != nil {
		utils.InternalServerError(c, "failed_to_fetch_top_users")
		return
	}

	if len(topScores) == 0 {
		utils.OKResponse(c, individualTimelineResponse{
			Users:    []individualInfo{},
			Timeline: []individualTimelinePoint{},
		})
		return
	}

	// Get user IDs for the top users
	userIDs := make([]uint, len(topScores))
	for i, score := range topScores {
		userIDs[i] = score.UserID
	}

	// Fetch user details
	var users []models.User
	if err := config.DB.Where("id IN ?", userIDs).Find(&users).Error; err != nil {
		utils.InternalServerError(c, "failed_to_fetch_users")
		return
	}

	// Create user map for quick lookup
	userMap := make(map[uint]models.User)
	for _, user := range users {
		userMap[user.ID] = user
	}

	// Generate colors for users
	colors := []string{
		"#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
		"#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
	}

	// Build users info in score order
	usersInfo := make([]individualInfo, 0, len(topScores))
	for i, score := range topScores {
		if user, ok := userMap[score.UserID]; ok {
			usersInfo = append(usersInfo, individualInfo{
				ID:       user.ID,
				Username: user.Username,
				Color:    colors[i%len(colors)],
			})
		}
	}

	// Get all solves for the top users ordered by time
	var allSolves []models.Solve
	if err := config.DB.Where("user_id IN ?", userIDs).
		Order("created_at ASC").
		Find(&allSolves).Error; err != nil {
		utils.InternalServerError(c, "failed_to_fetch_solves")
		return
	}

	// Build timeline
	timeline := []individualTimelinePoint{}
	userScoresMap := make(map[uint]int)

	for _, solve := range allSolves {
		// Add points from this solve
		userScoresMap[solve.UserID] += solve.Points

		// Create timeline point with current scores for all tracked users
		point := individualTimelinePoint{
			Time:   solve.CreatedAt.Format("15:04"),
			Scores: make(map[string]int),
		}

		for _, userInfo := range usersInfo {
			point.Scores[userInfo.Username] = userScoresMap[userInfo.ID]
		}

		timeline = append(timeline, point)
	}

	utils.OKResponse(c, individualTimelineResponse{
		Users:    usersInfo,
		Timeline: timeline,
	})
}
