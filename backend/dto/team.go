package dto

import "github.com/pwnthemall/pwnthemall/backend/models"

type SafeTeam struct {
	ID     uint           `json:"id"`
	Name   string         `json:"name"`
	Users  []SafeUser     `json:"users,omitempty"`
	Solves []models.Solve `json:"solves,omitempty"`
}

// CreateTeamInput represents team creation request
type CreateTeamInput struct {
	Name     string `json:"name" binding:"required,max=100"`
	Password string `json:"password" binding:"required,min=4"`
}

// JoinTeamInput represents team join request
type JoinTeamInput struct {
	TeamID   *uint  `json:"teamId"`
	Name     string `json:"name"`
	Password string `json:"password" binding:"required"`
}

// TeamScore represents team scoring information for leaderboard
type TeamScore struct {
	Team       SafeTeam `json:"team"`
	TotalScore int      `json:"totalScore"`
	SolveCount int      `json:"solveCount"`
}
