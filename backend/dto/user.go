package dto

// UserInput represents user creation/update request
type UserInput struct {
	Username string `json:"username" binding:"required,max=32"`
	Email    string `json:"email" binding:"required,email,max=254"`
	Password string `json:"password" binding:"omitempty,min=8,max=72"`
	Role     string `json:"role" binding:"required,oneof=member admin"`
	TeamID   *uint  `json:"teamId"`
}

// IndividualScore represents individual user scoring information for leaderboard
// Score is based on points from solves the user personally submitted
type IndividualScore struct {
	User       SafeUser `json:"user"`
	TeamName   string   `json:"teamName"`
	TotalScore int      `json:"totalScore"`
	SolveCount int      `json:"solveCount"`
}

type SafeUser struct {
	ID       uint   `json:"id"`
	Username string `json:"username"`
	Role     string `json:"role"`
}

type SafeUserWithTeam struct {
	ID       uint     `json:"id"`
	Username string   `json:"username"`
	Role     string   `json:"role"`
	Team     SafeTeam `json:"team"`
}
