package controllers

// Common query patterns
const (
	QueryTeamID           = "team_id = ?"
	QueryChallengeID      = "challenge_id = ?"
	QueryUserID           = "user_id = ?"
	QueryTeamAndChallenge = "team_id = ? AND challenge_id = ?"
	QueryChallengeAndTime = "challenge_id = ? AND created_at < ?"
)

// Common error messages
const (
	ErrUserNotFound         = "User not found"
	ErrChallengeNotFound    = "Challenge not found"
	ErrTeamNotFound         = "Team not found"
	ErrBadgeNotFound        = "Badge not found"
	ErrInstanceNotFound     = "Instance not found"
	ErrNotificationNotFound = "Notification not found"
	ErrUnauthorized         = "unauthorized"
	ErrInvalidInput         = "invalid_input"
	ErrInternalServer       = "internal_server_error"
)

// HTTP status messages
const (
	MsgSuccess = "success"
	MsgCreated = "created"
	MsgDeleted = "deleted successfully"
	MsgUpdated = "updated successfully"
)

// WebSocket event types
const (
	EventChallengeCategory = "challenge-category"
	EventTeamUpdate        = "team_update"
	EventInstanceStart     = "instance_start"
	EventInstanceStop      = "instance_stop"
	EventSubmission        = "submission"
	EventSolve             = "solve"
	EventHintPurchase      = "hint_purchase"
)

// WebSocket actions
const (
	ActionCreate          = "create"
	ActionUpdate          = "update"
	ActionDelete          = "delete"
	ActionChallengeUpdate = "challenge_update"
)

// Database field names
const (
	FieldTeamID      = "team_id"
	FieldChallengeID = "challenge_id"
	FieldUserID      = "user_id"
	FieldCreatedAt   = "created_at"
	FieldIsCorrect   = "is_correct"
)
