package dto

import "time"

// PublicProfileResponse represents the public profile data
type PublicProfileResponse struct {
	ID                uint                    `json:"id"`
	Username          string                  `json:"username"`
	MemberSince       time.Time               `json:"memberSince"`
	TeamID            *uint                   `json:"teamId,omitempty"`
	TeamName          string                  `json:"teamName,omitempty"`
	TotalPoints       int                     `json:"totalPoints"`
	ChallengesSolved  int                     `json:"challengesSolved"`
	TotalChallenges   int                     `json:"totalChallenges"`
	Ranking           int                     `json:"ranking"`
	SubmissionStats   SubmissionStatsResponse `json:"submissionStats"`
	CategoryBreakdown []CategoryBreakdown     `json:"categoryBreakdown"`
	RecentSolves      []RecentSolve           `json:"recentSolves"`
	SolveTimeline     []SolveTimelinePoint    `json:"solveTimeline"`
}

// SubmissionStatsResponse holds submission statistics
type SubmissionStatsResponse struct {
	TotalSubmissions   int     `json:"totalSubmissions"`
	CorrectSubmissions int     `json:"correctSubmissions"`
	WrongSubmissions   int     `json:"wrongSubmissions"`
	SuccessRate        float64 `json:"successRate"`
}

// CategoryBreakdown shows challenges solved per category
type CategoryBreakdown struct {
	CategoryID   uint   `json:"categoryId"`
	CategoryName string `json:"categoryName"`
	SolvedCount  int    `json:"solvedCount"`
	TotalCount   int    `json:"totalCount"`
	Color        string `json:"color"`
}

// RecentSolve represents a recently solved challenge
type RecentSolve struct {
	ChallengeID   uint      `json:"challengeId"`
	ChallengeName string    `json:"challengeName"`
	CategoryName  string    `json:"categoryName"`
	Points        int       `json:"points"`
	SolvedAgo     string    `json:"solvedAgo"`
	SolvedAt      time.Time `json:"solvedAt"`
}

// SolveTimelinePoint represents a point in the solve timeline
type SolveTimelinePoint struct {
	Date       string `json:"date"`
	Points     int    `json:"points"`
	Cumulative int    `json:"cumulative"`
}
