package controllers

import (
	"fmt"
	"math"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pwnthemall/pwnthemall/backend/config"
	"github.com/pwnthemall/pwnthemall/backend/dto"
	"github.com/pwnthemall/pwnthemall/backend/models"
	"github.com/pwnthemall/pwnthemall/backend/utils"
)

// Query constants to avoid duplication
const (
	queryUserID                 = "user_id = ?"
	joinChallengesOnSolves      = "JOIN challenges ON challenges.id = solves.challenge_id"
	whereSolvesUserAndNotHidden = "solves.user_id = ? AND challenges.hidden = ?"
	dateFormatYMD               = "2006-01-02"
	dateFormatISO               = "2006-01-02T15:04:05"
)

// individualSolve is used internally for timeline calculations
type individualSolve struct {
	CreatedAt time.Time
	Points    int
}

// GetPublicUserProfile returns public profile data for a user by username
func GetPublicUserProfile(c *gin.Context) {
	username := c.Param("username")
	if username == "" {
		utils.BadRequestError(c, "username_required")
		return
	}

	// Find user by username
	var user models.User
	if err := config.DB.Preload("Team").Where("username = ?", username).First(&user).Error; err != nil {
		utils.NotFoundError(c, "user_not_found")
		return
	}

	// Calculate user ranking based on individual leaderboard
	ranking := calculateUserRanking(user.ID)

	// Get team name
	teamName := ""
	if user.Team != nil {
		teamName = user.Team.Name
	}

	// Get total points from solves
	var totalPoints int
	config.DB.Model(&models.Solve{}).Where(queryUserID, user.ID).Select("COALESCE(SUM(points), 0)").Scan(&totalPoints)

	// Get challenges solved count (only non-hidden challenges)
	var challengesSolved int64
	config.DB.Model(&models.Solve{}).
		Joins(joinChallengesOnSolves).
		Where(whereSolvesUserAndNotHidden, user.ID, false).
		Count(&challengesSolved)

	// Get total available challenges (non-hidden with at least one flag)
	var totalChallenges int64
	config.DB.Table("flags").
		Joins("JOIN challenges ON challenges.id = flags.challenge_id").
		Where("challenges.hidden = ?", false).
		Select("COUNT(DISTINCT flags.challenge_id)").
		Count(&totalChallenges)

	// Get submission statistics
	submissionStats := getSubmissionStats(user.ID)

	// Get category breakdown
	categoryBreakdown := getCategoryBreakdown(user.ID)

	// Get recent solves (last 10)
	recentSolves := getRecentSolves(user.ID, 10)

	// Get solve timeline for chart
	solveTimeline := getSolveTimeline(user.ID)

	response := dto.PublicProfileResponse{
		ID:                user.ID,
		Username:          user.Username,
		MemberSince:       user.CreatedAt,
		TeamID:            user.TeamID,
		TeamName:          teamName,
		TotalPoints:       totalPoints,
		ChallengesSolved:  int(challengesSolved),
		TotalChallenges:   int(totalChallenges),
		Ranking:           ranking,
		SubmissionStats:   submissionStats,
		CategoryBreakdown: categoryBreakdown,
		RecentSolves:      recentSolves,
		SolveTimeline:     solveTimeline,
	}

	utils.OKResponse(c, response)
}

// calculateUserRanking calculates user's position in the individual leaderboard
func calculateUserRanking(userID uint) int {
	type userScore struct {
		UserID     uint
		TotalScore int
	}

	var scores []userScore
	config.DB.Model(&models.Solve{}).
		Select("user_id, COALESCE(SUM(points), 0) as total_score").
		Group("user_id").
		Order("total_score DESC").
		Scan(&scores)

	for i, score := range scores {
		if score.UserID == userID {
			return i + 1
		}
	}
	return 0 // Not ranked (no solves)
}

// getSubmissionStats returns submission statistics for a user
func getSubmissionStats(userID uint) dto.SubmissionStatsResponse {
	var totalSubmissions int64
	var correctSubmissions int64

	config.DB.Model(&models.Submission{}).Where(queryUserID, userID).Count(&totalSubmissions)
	config.DB.Model(&models.Submission{}).Where(queryUserID+" AND is_correct = ?", userID, true).Count(&correctSubmissions)

	// If no submissions exist, count solves as successful submissions (for seeded/demo data)
	if totalSubmissions == 0 {
		var solveCount int64
		config.DB.Model(&models.Solve{}).Where(queryUserID, userID).Count(&solveCount)
		if solveCount > 0 {
			totalSubmissions = solveCount
			correctSubmissions = solveCount
		}
	}

	wrongSubmissions := totalSubmissions - correctSubmissions
	var successRate float64
	if totalSubmissions > 0 {
		successRate = math.Round((float64(correctSubmissions)/float64(totalSubmissions)*100)*10) / 10
	}

	return dto.SubmissionStatsResponse{
		TotalSubmissions:   int(totalSubmissions),
		CorrectSubmissions: int(correctSubmissions),
		WrongSubmissions:   int(wrongSubmissions),
		SuccessRate:        successRate,
	}
}

// getCategoryBreakdown returns solved challenges grouped by category
func getCategoryBreakdown(userID uint) []dto.CategoryBreakdown {
	// Colors for categories
	colors := []string{
		"#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
		"#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
	}

	type categoryCount struct {
		CategoryID   uint
		CategoryName string
		SolvedCount  int
	}

	var results []categoryCount
	config.DB.Model(&models.Solve{}).
		Select("challenges.challenge_category_id as category_id, challenge_categories.name as category_name, COUNT(*) as solved_count").
		Joins(joinChallengesOnSolves).
		Joins("JOIN challenge_categories ON challenge_categories.id = challenges.challenge_category_id").
		Where(whereSolvesUserAndNotHidden, userID, false).
		Group("challenges.challenge_category_id, challenge_categories.name").
		Scan(&results)

	// Get total challenges per category
	type categoryTotal struct {
		CategoryID uint
		Total      int
	}
	var totals []categoryTotal
	config.DB.Model(&models.Challenge{}).
		Select("challenge_category_id as category_id, COUNT(*) as total").
		Where("hidden = ?", false).
		Group("challenge_category_id").
		Scan(&totals)

	totalMap := make(map[uint]int)
	for _, t := range totals {
		totalMap[t.CategoryID] = t.Total
	}

	breakdown := make([]dto.CategoryBreakdown, len(results))
	for i, r := range results {
		breakdown[i] = dto.CategoryBreakdown{
			CategoryID:   r.CategoryID,
			CategoryName: r.CategoryName,
			SolvedCount:  r.SolvedCount,
			TotalCount:   totalMap[r.CategoryID],
			Color:        colors[i%len(colors)],
		}
	}

	return breakdown
}

// getRecentSolves returns the most recent solved challenges
func getRecentSolves(userID uint, limit int) []dto.RecentSolve {
	type solveResult struct {
		ChallengeID   uint
		ChallengeName string
		CategoryName  string
		Points        int
		SolvedAt      time.Time
	}

	var results []solveResult
	config.DB.Model(&models.Solve{}).
		Select("solves.challenge_id, challenges.name as challenge_name, challenge_categories.name as category_name, solves.points, solves.created_at as solved_at").
		Joins(joinChallengesOnSolves).
		Joins("JOIN challenge_categories ON challenge_categories.id = challenges.challenge_category_id").
		Where(whereSolvesUserAndNotHidden, userID, false).
		Order("solves.created_at DESC").
		Limit(limit).
		Scan(&results)

	recentSolves := make([]dto.RecentSolve, len(results))
	now := time.Now()
	for i, r := range results {
		recentSolves[i] = dto.RecentSolve{
			ChallengeID:   r.ChallengeID,
			ChallengeName: r.ChallengeName,
			CategoryName:  r.CategoryName,
			Points:        r.Points,
			SolvedAgo:     formatTimeAgo(r.SolvedAt, now),
			SolvedAt:      r.SolvedAt,
		}
	}

	return recentSolves
}

// getSolveTimeline returns solve activity over time for charts
// Dynamically chooses granularity based on solve distribution:
// - If solves span multiple days: group by date
// - If all solves are within same day: show individual solve timestamps
func getSolveTimeline(userID uint) []dto.SolveTimelinePoint {
	var solves []individualSolve
	config.DB.Model(&models.Solve{}).
		Select("created_at, points").
		Where(queryUserID, userID).
		Order("created_at ASC").
		Scan(&solves)

	if len(solves) == 0 {
		return []dto.SolveTimelinePoint{}
	}

	// Check if all solves are within the same day
	firstDate := solves[0].CreatedAt.Format(dateFormatYMD)
	lastDate := solves[len(solves)-1].CreatedAt.Format(dateFormatYMD)
	allSameDay := firstDate == lastDate

	if allSameDay {
		// Use timestamps for granularity when all solves are on same day
		return buildTimelineFromTimestamps(solves)
	}

	// Multiple days - group by date
	return buildTimelineFromDates(userID, solves)
}

// buildTimelineFromTimestamps creates a timeline with individual solve timestamps
func buildTimelineFromTimestamps(solves []individualSolve) []dto.SolveTimelinePoint {
	if len(solves) == 0 {
		return []dto.SolveTimelinePoint{}
	}

	// Check if all solves have the exact same timestamp
	firstTime := solves[0].CreatedAt
	allSameTime := true
	for _, s := range solves[1:] {
		if !s.CreatedAt.Equal(firstTime) {
			allSameTime = false
			break
		}
	}

	timeline := make([]dto.SolveTimelinePoint, 0, len(solves)+2)

	if allSameTime {
		// All solves at exact same timestamp - space them out artificially
		// Create a synthetic timeline spread over 1 hour
		startTime := firstTime.Add(-5 * time.Minute)
		interval := time.Hour / time.Duration(len(solves)+1)

		// Add starting point
		timeline = append(timeline, dto.SolveTimelinePoint{
			Date:       startTime.Format(dateFormatISO),
			Points:     0,
			Cumulative: 0,
		})

		// Add each solve with synthetic spacing
		cumulative := 0
		for i, s := range solves {
			cumulative += s.Points
			syntheticTime := startTime.Add(interval * time.Duration(i+1))
			timeline = append(timeline, dto.SolveTimelinePoint{
				Date:       syntheticTime.Format(dateFormatISO),
				Points:     s.Points,
				Cumulative: cumulative,
			})
		}
	} else {
		// Normal case - solves have different timestamps
		startTime := firstTime.Add(-1 * time.Minute)

		// Add starting point
		timeline = append(timeline, dto.SolveTimelinePoint{
			Date:       startTime.Format(dateFormatISO),
			Points:     0,
			Cumulative: 0,
		})

		// Add each solve with actual timestamp
		cumulative := 0
		for _, s := range solves {
			cumulative += s.Points
			timeline = append(timeline, dto.SolveTimelinePoint{
				Date:       s.CreatedAt.Format(dateFormatISO),
				Points:     s.Points,
				Cumulative: cumulative,
			})
		}
	}

	return timeline
}

// buildTimelineFromDates creates a timeline grouped by date
func buildTimelineFromDates(userID uint, solves []individualSolve) []dto.SolveTimelinePoint {
	type solvePoint struct {
		Date   string
		Points int
	}

	var results []solvePoint
	config.DB.Model(&models.Solve{}).
		Select("DATE(created_at) as date, SUM(points) as points").
		Where(queryUserID, userID).
		Group("DATE(created_at)").
		Order("date ASC").
		Scan(&results)

	if len(results) == 0 {
		return []dto.SolveTimelinePoint{}
	}

	// Add a starting point at 0 (day before first solve)
	firstDate, _ := time.Parse(dateFormatYMD, results[0].Date)
	startDate := firstDate.AddDate(0, 0, -1)

	timeline := make([]dto.SolveTimelinePoint, 0, len(results)+1)

	// Add starting point
	timeline = append(timeline, dto.SolveTimelinePoint{
		Date:       startDate.Format(dateFormatYMD),
		Points:     0,
		Cumulative: 0,
	})

	// Add each date's solves
	cumulative := 0
	for _, r := range results {
		cumulative += r.Points
		timeline = append(timeline, dto.SolveTimelinePoint{
			Date:       r.Date,
			Points:     r.Points,
			Cumulative: cumulative,
		})
	}

	return timeline
}

// formatTimeAgo returns a human-readable time difference
func formatTimeAgo(t time.Time, now time.Time) string {
	diff := now.Sub(t)

	if diff < time.Hour {
		minutes := int(diff.Minutes())
		if minutes <= 1 {
			return "just now"
		}
		return formatPlural(minutes, "minute") + " ago"
	}

	if diff < 24*time.Hour {
		hours := int(diff.Hours())
		return formatPlural(hours, "hour") + " ago"
	}

	days := int(diff.Hours() / 24)
	if days < 30 {
		return formatPlural(days, "day") + " ago"
	}

	months := days / 30
	if months < 12 {
		return formatPlural(months, "month") + " ago"
	}

	years := months / 12
	return formatPlural(years, "year") + " ago"
}

func formatPlural(n int, unit string) string {
	if n == 1 {
		return "1 " + unit
	}
	return fmt.Sprintf("%d %ss", n, unit)
}
