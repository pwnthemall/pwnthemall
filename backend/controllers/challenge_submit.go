package controllers

import (
	"encoding/json"
	"fmt"

	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pwnthemall/pwnthemall/backend/config"
	"github.com/pwnthemall/pwnthemall/backend/debug"
	"github.com/pwnthemall/pwnthemall/backend/dto"
	"github.com/pwnthemall/pwnthemall/backend/models"
	"github.com/pwnthemall/pwnthemall/backend/utils"
)

const (
	queryTeamAndChallengeID = "team_id = ? AND challenge_id = ?"
	queryChallengeID        = "challenge_id = ?"
	errChallengeNotFound    = "challenge_not_found"
	errInvalidInput         = "invalid_input"
	errUnauthorized         = "unauthorized"
	errTeamRequired         = "team_required"
	errAlreadySolved        = "challenge_already_solved"
	errMaxAttemptsReached   = "max_attempts_reached"
	errFlagAlreadySubmitted = "flag_already_submitted"
	errSubmissionCreateFail = "submission_create_failed"
	errSolveCreateFail      = "solve_create_failed"
	errIncorrectLocation    = "incorrect_location"
	errWrongFlag            = "wrong_flag"
	msgChallengeSolved      = "challenge_solved"
)

// extractSubmittedValue extracts the submitted flag or geo coordinates from input
func extractSubmittedValue(inputRaw map[string]interface{}) string {
	if v, ok := inputRaw["flag"]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}

	// Check for geo submission
	if latV, ok := inputRaw["lat"].(float64); ok {
		if lngV, ok2 := inputRaw["lng"].(float64); ok2 {
			return fmt.Sprintf("geo:%f,%f", latV, lngV)
		}
	}

	return ""
}

// validateStandardFlag checks if submitted value matches any standard flag
func validateStandardFlag(submittedValue string, flags []models.Flag) bool {
	if submittedValue == "" {
		return false
	}

	for _, flag := range flags {
		if !utils.IsGeoFlag(flag.Value) && flag.Value == utils.HashFlag(submittedValue) {
			return true
		}
	}
	return false
}

// validateGeoFlag checks if submitted coordinates match geo flag requirements
func validateGeoFlag(inputRaw map[string]interface{}, flags []models.Flag) bool {
	lat, ok1 := inputRaw["lat"].(float64)
	lng, ok2 := inputRaw["lng"].(float64)

	if !ok1 || !ok2 {
		return false
	}

	for _, flag := range flags {
		if utils.IsGeoFlag(flag.Value) {
			if targetLat, targetLng, radius, ok := utils.ParseGeoSpecFromHashed(flag.Value); ok {
				if utils.IsWithinRadiusKm(targetLat, targetLng, lat, lng, radius) {
					return true
				}
			}
		}
	}
	return false
}

// validateGeoSpec checks submission against stored GeoSpec for geo challenges
func validateGeoSpec(inputRaw map[string]interface{}, challengeID uint) bool {
	lat, ok1 := inputRaw["lat"].(float64)
	lng, ok2 := inputRaw["lng"].(float64)

	if !ok1 || !ok2 {
		debug.Log("GeoValidation: No lat/lng coordinates found in submission for challenge %d", challengeID)
		return false
	}

	var spec models.GeoSpec
	if err := config.DB.Where(queryChallengeID, challengeID).First(&spec).Error; err != nil {
		debug.Log("GeoValidation: No GeoSpec found for challenge %d: %v", challengeID, err)
		return false
	}

	debug.Log("GeoValidation: Checking challenge %d submission (lat=%f,lng=%f) against target (lat=%f,lng=%f) radius=%fkm",
		challengeID, lat, lng, spec.TargetLat, spec.TargetLng, spec.RadiusKm)

	if utils.IsWithinRadiusKm(spec.TargetLat, spec.TargetLng, lat, lng, spec.RadiusKm) {
		debug.Log("GeoValidation: CORRECT - Submission within radius for challenge %d", challengeID)
		return true
	}

	debug.Log("GeoValidation: INCORRECT - Submission outside radius for challenge %d", challengeID)
	return false
}

// validateFlagSubmission performs all flag validation checks
func validateFlagSubmission(inputRaw map[string]interface{}, challenge models.Challenge, submittedValue string) bool {
	// Check standard flags
	if validateStandardFlag(submittedValue, challenge.Flags) {
		return true
	}

	// Check geo flags from flags table
	if validateGeoFlag(inputRaw, challenge.Flags) {
		return true
	}

	// Check alternative flag format from inputRaw
	if v, ok := inputRaw["flag"].(string); ok {
		for _, flag := range challenge.Flags {
			if !utils.IsGeoFlag(flag.Value) && flag.Value == utils.HashFlag(v) {
				return true
			}
		}
	}

	// Check geo spec for geo challenges
	if challenge.ChallengeType != nil && strings.ToLower(challenge.ChallengeType.Name) == "geo" {
		if validateGeoSpec(inputRaw, challenge.ID) {
			return true
		}
	}

	return false
}

// calculateFirstBloodBonus determines the first blood bonus for a solve position
func calculateFirstBloodBonus(challenge models.Challenge, position int64) int {
	if !challenge.EnableFirstBlood || len(challenge.FirstBloodBonuses) == 0 {
		debug.Log("FirstBlood: FirstBlood not enabled or no bonuses configured")
		return 0
	}

	pos := int(position)
	if pos >= len(challenge.FirstBloodBonuses) {
		debug.Log("FirstBlood: Position %d beyond configured bonuses (%d available)", pos, len(challenge.FirstBloodBonuses))
		return 0
	}

	bonus := int(challenge.FirstBloodBonuses[pos])
	debug.Log("FirstBlood: Position %d gets bonus %d points", pos, bonus)
	return bonus
}

// createFirstBloodEntry creates a FirstBlood database entry
func createFirstBloodEntry(challenge models.Challenge, user *models.User, position int64, bonus int) error {
	if bonus <= 0 {
		return nil
	}

	badge := "trophy" // default badge
	if int(position) < len(challenge.FirstBloodBadges) {
		badge = challenge.FirstBloodBadges[position]
	}

	firstBlood := models.FirstBlood{
		ChallengeID: challenge.ID,
		TeamID:      user.Team.ID,
		UserID:      user.ID,
		Bonuses:     []int64{int64(bonus)},
		Badges:      []string{badge},
	}

	if err := config.DB.Create(&firstBlood).Error; err != nil {
		debug.Log("Failed to create FirstBlood entry: %v", err)
		return err
	}

	debug.Log("Created FirstBlood entry for user %d, challenge %d, position %d, bonus %d points",
		user.ID, challenge.ID, position, bonus)
	return nil
}

// broadcastTeamSolve sends WebSocket event for team solve
func broadcastTeamSolve(user *models.User, challenge models.Challenge, totalPoints int) {
	if utils.WebSocketHub == nil {
		return
	}

	event := dto.TeamSolveEvent{
		Event:         "team_solve",
		TeamID:        user.Team.ID,
		ChallengeID:   challenge.ID,
		ChallengeName: challenge.Name,
		Points:        totalPoints,
		UserID:        user.ID,
		Username:      user.Username,
		Timestamp:     time.Now().UTC().Unix(),
	}

	if payload, err := json.Marshal(event); err == nil {
		utils.WebSocketHub.SendToTeamExcept(user.Team.ID, user.ID, payload)
	}
}

// stopInstanceOnSolve stops the running instance for a team when challenge is solved
func stopInstanceOnSolve(teamID uint, challengeID uint, actorID uint, actorName string) {
	var instance models.Instance
	if err := config.DB.Where(queryTeamAndChallengeID, teamID, challengeID).First(&instance).Error; err != nil {
		return
	}

	// Try stopping the container
	if instance.Name != "" {
		if err := utils.StopDockerInstance(instance.Name); err != nil {
			debug.Log("Failed to stop Docker instance on solve: %v", err)
		}
	}

	// Remove instance record to free the slot
	if err := config.DB.Delete(&instance).Error; err != nil {
		debug.Log("Failed to delete instance on solve: %v", err)
	}

	// Notify team listeners that instance stopped
	if utils.WebSocketHub != nil {
		evt := dto.InstanceEvent{
			Event:       "instance_update",
			TeamID:      teamID,
			UserID:      actorID,
			Username:    actorName,
			ChallengeID: challengeID,
			Status:      "stopped",
			UpdatedAt:   time.Now().UTC().Unix(),
		}
		if payload, err := json.Marshal(evt); err == nil {
			utils.WebSocketHub.SendToTeamExcept(teamID, actorID, payload)
		}
	}
}

// checkExistingSolve returns true if team has already solved the challenge
func checkExistingSolve(teamID uint, challengeID uint) bool {
	var existingSolve models.Solve
	return config.DB.Where(queryTeamAndChallengeID, teamID, challengeID).First(&existingSolve).Error == nil
}

// checkAttemptsLimit returns true if team has exceeded max attempts
func checkAttemptsLimit(teamID uint, challenge models.Challenge) bool {
	if challenge.MaxAttempts <= 0 {
		return false
	}

	var failedAttempts int64
	config.DB.Model(&models.Submission{}).
		Joins("JOIN users ON users.id = submissions.user_id").
		Where("users.team_id = ? AND submissions.challenge_id = ? AND submissions.is_correct = ?",
			teamID, challenge.ID, false).
		Count(&failedAttempts)

	return int(failedAttempts) >= challenge.MaxAttempts
}

// checkDuplicateSubmission checks if exact submission already exists
func checkDuplicateSubmission(userID uint, challengeID uint, submittedValue string) (exists bool, wasCorrect bool) {
	var existingSubmission models.Submission
	err := config.DB.Where("user_id = ? AND challenge_id = ? AND value = ?",
		userID, challengeID, submittedValue).First(&existingSubmission).Error

	if err == nil {
		return true, existingSubmission.IsCorrect
	}
	return false, false
}

// handleCorrectSubmission processes a correct flag submission
func handleCorrectSubmission(c *gin.Context, user *models.User, challenge models.Challenge) {
	// Admin without team: return success without recording solve
	if user.Role == "admin" && (user.Team == nil || user.TeamID == nil) {
		debug.Log("AdminTest: Flag correct for challenge %d (admin: %s)", challenge.ID, user.Username)
		utils.OKResponse(c, gin.H{"message": msgChallengeSolved, "testMode": true})
		return
	}

	// Calculate solve position
	var position int64
	config.DB.Model(&models.Solve{}).Where(queryChallengeID, challenge.ID).Count(&position)

	debug.Log("FirstBlood: Challenge %d, Position %d, EnableFirstBlood: %v, Bonuses count: %d",
		challenge.ID, position, challenge.EnableFirstBlood, len(challenge.FirstBloodBonuses))

	// Calculate first blood bonus
	firstBloodBonus := calculateFirstBloodBonus(challenge, position)
	totalPoints := challenge.Points + firstBloodBonus

	// Create solve record
	var solve models.Solve
	if err := config.DB.FirstOrCreate(&solve,
		models.Solve{
			TeamID:      user.Team.ID,
			ChallengeID: challenge.ID,
			UserID:      user.ID,
			Points:      totalPoints,
		}).Error; err != nil {
		utils.InternalServerError(c, errSolveCreateFail)
		return
	}

	// Create FirstBlood entry if applicable
	createFirstBloodEntry(challenge, user, position, firstBloodBonus)

	// Broadcast team solve event
	broadcastTeamSolve(user, challenge, totalPoints)

	// Stop instance asynchronously
	go stopInstanceOnSolve(user.Team.ID, challenge.ID, user.ID, user.Username)

	utils.OKResponse(c, gin.H{"message": msgChallengeSolved})
}

// handleIncorrectSubmission processes an incorrect flag submission
func handleIncorrectSubmission(c *gin.Context, challenge models.Challenge) {
	if challenge.ChallengeType != nil && strings.ToLower(challenge.ChallengeType.Name) == "geo" {
		utils.ForbiddenError(c, errIncorrectLocation)
	} else {
		utils.ForbiddenError(c, errWrongFlag)
	}
}

// validateSubmissionPreconditions checks all preconditions for submission
func validateSubmissionPreconditions(c *gin.Context, user *models.User, challenge models.Challenge) bool {
	// Admin without team: allow testing (won't record solve)
	isAdminTest := user.Role == "admin" && (user.Team == nil || user.TeamID == nil)
	if isAdminTest {
		return true
	}

	// Validate user has a team
	if user.Team == nil || user.TeamID == nil {
		utils.ForbiddenError(c, errTeamRequired)
		return false
	}

	// Check CTF timing
	ctfStatus := config.GetCTFStatus()
	if ctfStatus == config.CTFNotStarted {
		utils.ForbiddenError(c, "flag_submission_not_available_yet")
		return false
	}
	if ctfStatus == config.CTFEnded {
		utils.ForbiddenError(c, "flag_submission_no_longer_available")
		return false
	}

	// Check if already solved
	if checkExistingSolve(user.Team.ID, challenge.ID) {
		utils.ConflictError(c, errAlreadySolved)
		return false
	}

	// Check attempts limit
	if checkAttemptsLimit(user.Team.ID, challenge) {
		utils.ForbiddenError(c, errMaxAttemptsReached)
		return false
	}

	if !CheckChallengeDependancies(c, challenge) {
		utils.NotFoundError(c, errChallengeNotFound)
		return false
	}

	return true
}

// SubmitChallenge handles challenge flag submission
func SubmitChallenge(c *gin.Context) {
	// Load challenge with preloaded relationships
	var challenge models.Challenge
	challengeId := c.Param("id")
	if err := config.DB.Preload("Flags").Preload("ChallengeType").Where("id = ?", challengeId).First(&challenge).Error; err != nil {
		utils.NotFoundError(c, errChallengeNotFound)
		return
	}

	// Parse input
	var inputRaw map[string]interface{}
	if err := c.ShouldBindJSON(&inputRaw); err != nil {
		utils.BadRequestError(c, errInvalidInput)
		return
	}

	// Get authenticated user
	userI, exists := c.Get("user")
	if !exists {
		utils.UnauthorizedError(c, errUnauthorized)
		return
	}
	user, ok := userI.(*models.User)
	if !ok {
		utils.InternalServerError(c, "user_wrong_type")
		return
	}

	// Validate all preconditions
	if !validateSubmissionPreconditions(c, user, challenge) {
		return
	}

	// Extract submitted value
	submittedValue := extractSubmittedValue(inputRaw)

	// Check for duplicate submission (skip for geo challenges as coordinates vary slightly)
	isGeoChallenge := challenge.ChallengeType != nil && strings.ToLower(challenge.ChallengeType.Name) == "geo"
	if !isGeoChallenge {
		if exists, wasCorrect := checkDuplicateSubmission(user.ID, challenge.ID, submittedValue); exists {
			if wasCorrect {
				utils.ConflictError(c, errAlreadySolved)
			} else if challenge.MaxAttempts > 0 {
				// Only show "already submitted" error when max attempts is configured
				utils.ConflictError(c, errFlagAlreadySubmitted)
			} else {
				// For challenges without max attempts, allow resubmission and just return wrong flag
				handleIncorrectSubmission(c, challenge)
			}
			return
		}
	}

	// Validate flag
	isCorrect := validateFlagSubmission(inputRaw, challenge, submittedValue)

	if isCorrect {
		submittedValue = utils.HashFlag(submittedValue)
	}

	// Create submission record
	submission := models.Submission{
		Value:       submittedValue,
		IsCorrect:   isCorrect,
		UserID:      user.ID,
		ChallengeID: challenge.ID,
	}
	if err := config.DB.Create(&submission).Error; err != nil {
		utils.InternalServerError(c, errSubmissionCreateFail)
		return
	}

	// Handle result
	if isCorrect {
		handleCorrectSubmission(c, user, challenge)
	} else {
		handleIncorrectSubmission(c, challenge)
	}
}

// GetChallengeSolves returns all solves for a challenge with user information
func GetChallengeSolves(c *gin.Context) {
	var challenge models.Challenge
	id := c.Param("id")

	result := config.DB.Preload("DecayFormula").First(&challenge, id)
	if result.Error != nil {
		utils.NotFoundError(c, "Challenge not found")
		return
	}

	// Get solves with team information
	var solves []models.Solve
	result = config.DB.
		Preload("Team").
		Preload("User").
		Where("challenge_id = ?", challenge.ID).
		Order("created_at ASC").
		Find(&solves)

	if result.Error != nil {
		utils.InternalServerError(c, result.Error.Error())
		return
	}

	// Initialize decay service for current points calculation
	decayService := utils.NewDecay()
	currentPoints := decayService.CalculateCurrentPoints(&challenge)

	var solvesWithUsers []dto.SolveWithUser

	for _, solve := range solves {
		solveWithUser := dto.SolveWithUser{
			Solve:         solve,
			CurrentPoints: currentPoints, // Add current decayed points
		}

		// Use the data from the solve record itself
		if solve.UserID != 0 {
			solveWithUser.UserID = solve.UserID
			// Use SolvedBy if available, otherwise try to get username from User relation
			if solve.SolvedBy != "" {
				solveWithUser.Username = solve.SolvedBy
			} else if solve.User != nil {
				solveWithUser.Username = solve.User.Username
			}
		}

		// Check if this solve has a FirstBlood entry
		var firstBlood models.FirstBlood
		if err := config.DB.Where("challenge_id = ? AND team_id = ? AND user_id = ?",
			challenge.ID, solve.TeamID, solve.UserID).First(&firstBlood).Error; err == nil {
			solveWithUser.FirstBlood = &firstBlood
		}

		solvesWithUsers = append(solvesWithUsers, solveWithUser)
	}

	utils.OKResponse(c, solvesWithUsers)
}
