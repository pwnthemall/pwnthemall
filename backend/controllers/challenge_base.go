package controllers

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"

	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jinzhu/copier"
	"github.com/minio/minio-go/v7"
	"github.com/pwnthemall/pwnthemall/backend/config"
	"github.com/pwnthemall/pwnthemall/backend/debug"
	"github.com/pwnthemall/pwnthemall/backend/dto"
	"github.com/pwnthemall/pwnthemall/backend/models"
	"github.com/pwnthemall/pwnthemall/backend/utils"
	"gorm.io/gorm"
)

// getSolvedChallengeIds retrieves all challenge IDs solved by a team
func getSolvedChallengeIds(teamID uint) []uint {
	var solves []models.Solve
	var solvedIds []uint

	if err := config.DB.Where(queryTeamID, teamID).Find(&solves).Error; err == nil {
		for _, solve := range solves {
			solvedIds = append(solvedIds, solve.ChallengeID)
		}
	}

	return solvedIds
}

// getPurchasedHintIds retrieves all hint IDs purchased by a team
func getPurchasedHintIds(teamID uint) []uint {
	var purchases []models.HintPurchase
	var purchasedIds []uint

	if err := config.DB.Where(queryTeamID, teamID).Find(&purchases).Error; err == nil {
		for _, purchase := range purchases {
			purchasedIds = append(purchasedIds, purchase.HintID)
		}
	}

	return purchasedIds
}

// getTeamFailedAttempts counts failed attempts for challenges with MaxAttempts set
func getTeamFailedAttempts(teamID uint, challenges []models.Challenge) map[uint]int64 {
	failedAttemptsMap := make(map[uint]int64)

	for _, challenge := range challenges {
		if challenge.MaxAttempts > 0 {
			var count int64
			config.DB.Model(&models.Submission{}).
				Joins("JOIN users ON users.id = submissions.user_id").
				Where("users.team_id = ? AND submissions.challenge_id = ? AND submissions.is_correct = ?",
					teamID, challenge.ID, false).
				Count(&count)
			failedAttemptsMap[challenge.ID] = count
		}
	}

	return failedAttemptsMap
}

// processHintsWithPurchaseStatus filters hints and adds purchase status
func processHintsWithPurchaseStatus(hints []models.Hint, purchasedHintIds []uint, userRole string) []dto.HintWithPurchased {
	var hintsWithPurchased []dto.HintWithPurchased
	debug.Log("processHintsWithPurchaseStatus (hints): %v", hints)
	for _, hint := range hints {
		debug.Log("Hint ID %d: IsActive=%t, User Role=%s", hint.ID, hint.IsActive, userRole)

		if !hint.IsActive && userRole != "admin" {
			debug.Log("Skipping inactive hint ID %d for non-admin user", hint.ID)
			continue
		}
		var hintWithPurchased dto.HintWithPurchased
		var hintDTO dto.Hint
		copier.Copy(&hintDTO, &hint)

		hintWithPurchased.Hint = hintDTO
		hintWithPurchased.Hint.Content = ""
		hintWithPurchased.Purchased = false
		for _, purchasedId := range purchasedHintIds {
			if hint.ID == purchasedId {
				hintWithPurchased.Hint = hintDTO
				hintWithPurchased.Purchased = true
				break
			}
		}
		hintsWithPurchased = append(hintsWithPurchased, hintWithPurchased)
	}

	return hintsWithPurchased
}

// addGeoSpecIfNeeded adds geo radius to challenge if it's a geo type
func addGeoSpecIfNeeded(challenge models.Challenge, item *dto.ChallengeWithSolved) {
	if challenge.ChallengeType != nil && strings.ToLower(challenge.ChallengeType.Name) == "geo" {
		var spec models.GeoSpec
		if err := config.DB.Where(queryChallengeID, challenge.ID).First(&spec).Error; err == nil {
			r := spec.RadiusKm
			item.GeoRadiusKm = &r
		}
	}
}

// buildChallengeWithSolved creates a challenge DTO with solved status and hints
func buildChallengeWithSolved(challenge models.Challenge, solvedChallengeIds []uint, purchasedHintIds []uint, failedAttemptsMap map[uint]int64, userRole string, decayService *utils.DecayService) dto.ChallengeWithSolved {
	solved := false
	for _, solvedId := range solvedChallengeIds {
		if challenge.ID == solvedId {
			solved = true
			break
		}
	}

	// Compute current points with decay
	challenge.CurrentPoints = decayService.CalculateCurrentPoints(&challenge)

	// Process hints
	hintsWithPurchased := processHintsWithPurchaseStatus(challenge.Hints, purchasedHintIds, userRole)
	item := dto.ChallengeWithSolved{
		Solved:             solved,
		TeamFailedAttempts: failedAttemptsMap[challenge.ID],
	}
	copier.Copy(&item, &challenge)
	item.Hints = hintsWithPurchased
	// Add geo spec if applicable
	addGeoSpecIfNeeded(challenge, &item)

	return item
}

func CheckChallengeDependancies(c *gin.Context, challenge models.Challenge) bool {
	userI, _ := c.Get("user")
	user, ok := userI.(*models.User)
	if !ok {
		return false
	}
	if user.Role == "admin" {
		return true
	}
	solvedNamesMap := make(map[string]bool)
	var solvedChallenges []models.Challenge
	config.DB.Table("challenges").
		Joins("JOIN solves ON solves.challenge_id = challenges.id").
		Where("solves.team_id = ?", user.Team.ID).
		Select("challenges.name").
		Find(&solvedChallenges)
	for _, ch := range solvedChallenges {
		solvedNamesMap[ch.Name] = true
	}

	if challenge.DependsOn != "" && !solvedNamesMap[challenge.DependsOn] {
		return false
	}
	return true
}

// GetChallenges returns all visible challenges
func GetChallenges(c *gin.Context) {
	userI, _ := c.Get("user")
	user, ok := userI.(*models.User)
	if !ok {
		utils.InternalServerError(c, "user_wrong_type")
		return
	}

	var challenges []models.Challenge
	result := config.DB.Preload("DecayFormula").Preload("Hints").Where("hidden = false").Find(&challenges)
	if result.Error != nil {
		utils.InternalServerError(c, result.Error.Error())
		return
	}

	if user.Role == "admin" {
		utils.OKResponse(c, challenges)
		return
	}

	filtered := make([]models.Challenge, 0, len(challenges))
	decayService := utils.NewDecay()

	for i := range challenges {
		if !CheckChallengeDependancies(c, challenges[i]) {
			continue
		}
		challenges[i].CurrentPoints = decayService.CalculateCurrentPoints(&challenges[i])
		filtered = append(filtered, challenges[i])
	}

	utils.OKResponse(c, filtered)
}

// GetChallenge returns a single challenge by ID
func GetChallenge(c *gin.Context) {
	var challenge models.Challenge
	id := c.Param("id")

	result := config.DB.Preload("DecayFormula").Preload("Hints").First(&challenge, id)
	if result.Error != nil {
		utils.NotFoundError(c, "challenge_not_found")
		return
	}

	if !CheckChallengeDependancies(c, challenge) {
		utils.NotFoundError(c, "challenge_not_found")
		return
	}

	decayService := utils.NewDecay()
	challenge.CurrentPoints = decayService.CalculateCurrentPoints(&challenge)

	utils.OKResponse(c, challenge)
}

// GetChallengesByCategoryName returns all challenges in a category with solved status
func GetChallengesByCategoryName(c *gin.Context) {
	categoryName := c.Param("category")

	// Get and validate user
	userI, _ := c.Get("user")
	user, ok := userI.(*models.User)
	if !ok {
		utils.InternalServerError(c, "user_wrong_type")
		return
	}

	// Load challenges for category
	var challenges []models.Challenge
	result := config.DB.
		Preload("ChallengeCategory").
		Preload("ChallengeType").
		Preload("ChallengeDifficulty").
		Preload("DecayFormula").
		Preload("Hints").
		Joins("JOIN challenge_categories ON challenge_categories.id = challenges.challenge_category_id").
		Where("challenge_categories.name = ? and hidden = false", categoryName).
		Order("challenges.\"order\" ASC, challenges.id ASC").
		Find(&challenges)

	if result.Error != nil {
		utils.InternalServerError(c, result.Error.Error())
		return
	}

	// Get team-specific data
	var solvedChallengeIds []uint
	var purchasedHintIds []uint
	var failedAttemptsMap map[uint]int64

	if user.Team != nil {
		solvedChallengeIds = getSolvedChallengeIds(user.Team.ID)
		purchasedHintIds = getPurchasedHintIds(user.Team.ID)
		failedAttemptsMap = getTeamFailedAttempts(user.Team.ID, challenges)
	} else {
		failedAttemptsMap = make(map[uint]int64)
	}

	// Check and activate scheduled hints
	utils.CheckAndActivateHintsForChallenges(challenges)

	// Build a map of solved challenge names for dependency checking
	solvedNamesMap := make(map[string]bool)
	if user.Team != nil {
		var solvedChallenges []models.Challenge
		config.DB.Table("challenges").
			Joins("JOIN solves ON solves.challenge_id = challenges.id").
			Where("solves.team_id = ?", user.Team.ID).
			Select("challenges.name").
			Find(&solvedChallenges)
		for _, ch := range solvedChallenges {
			solvedNamesMap[ch.Name] = true
		}
	}

	// Build response with solved status
	decayService := utils.NewDecay()
	var challengesWithSolved []dto.ChallengeWithSolved

	// Build a map of challenge names to their data for dependency ordering
	challengeMap := make(map[string]models.Challenge)
	for _, challenge := range challenges {
		challengeMap[challenge.Name] = challenge
	}

	// Sort challenges respecting dependency chains
	var orderedChallenges []models.Challenge
	processedNames := make(map[string]bool)

	// Helper function to add a challenge and its dependencies recursively
	var addChallengeWithDeps func(string)
	addChallengeWithDeps = func(name string) {
		if processedNames[name] {
			return
		}

		challenge, exists := challengeMap[name]
		if !exists {
			return
		}

		// First, add the dependency if it exists
		if challenge.DependsOn != "" {
			addChallengeWithDeps(challenge.DependsOn)
		}

		// Then add this challenge
		orderedChallenges = append(orderedChallenges, challenge)
		processedNames[name] = true
	}

	// Process all challenges in their original order, but respect dependencies
	for _, challenge := range challenges {
		addChallengeWithDeps(challenge.Name)
	}

	// Build response from ordered challenges
	for _, challenge := range orderedChallenges {
		// Check if challenge has a dependency and if user is not admin
		if !CheckChallengeDependancies(c, challenge) {
			continue
		}

		item := buildChallengeWithSolved(challenge, solvedChallengeIds, purchasedHintIds, failedAttemptsMap, user.Role, decayService)
		challengesWithSolved = append(challengesWithSolved, item)
	}
	debug.Log("challengesWithSolved: %v", challengesWithSolved)
	utils.OKResponse(c, challengesWithSolved)
}

const (
	maxSizePerFile             = 1024 * 1024 * 256 // 256 MB
	bucketChallengeFiles       = "challenge-files"
	formFieldFiles             = "files"
	formFieldMeta              = "meta"
	errInvalidMultipartForm    = "invalid_multipart_form"
	errFileExceedsMaxSize      = "file %s exceeds max size (256MB)"
	errMissingMeta             = "missing_meta"
	errInvalidMetaJSON         = "invalid_meta_json"
	errInvalidChallengeData    = "invalid_challenge_data"
	errMissingChallengeName    = "missing_challenge_name"
	errChallengeCreationFailed = "challenge_creation_failed"
)

func validateAndProcessFiles(form *multipart.Form, zipWriter *zip.Writer) (bool, error) {
	hasFiles := false

	if form == nil || form.File == nil {
		return hasFiles, nil
	}

	files, ok := form.File[formFieldFiles]
	if !ok {
		return hasFiles, nil
	}

	for _, fileHeader := range files {
		if fileHeader.Size > maxSizePerFile {
			return false, fmt.Errorf(errFileExceedsMaxSize, fileHeader.Filename)
		}

		file, err := fileHeader.Open()
		if err != nil {
			return false, err
		}
		defer file.Close()

		w, err := zipWriter.Create(fileHeader.Filename)
		if err != nil {
			return false, err
		}

		if _, err = io.Copy(w, file); err != nil {
			return false, err
		}

		hasFiles = true
	}

	return hasFiles, nil
}

func parseAndValidateMeta(metaStr string) (*models.Challenge, error) {
	if metaStr == "" {
		return nil, fmt.Errorf(errMissingMeta)
	}

	var metaMap map[string]interface{}
	if err := json.Unmarshal([]byte(metaStr), &metaMap); err != nil {
		return nil, fmt.Errorf(errInvalidMetaJSON)
	}

	var challenge models.Challenge
	challengeBytes, _ := json.Marshal(metaMap)
	if err := json.Unmarshal(challengeBytes, &challenge); err != nil {
		return nil, fmt.Errorf(errInvalidChallengeData)
	}

	if challenge.Name == "" {
		return nil, fmt.Errorf(errMissingChallengeName)
	}

	return &challenge, nil
}

// createChallengeZipFromDB exports challenge as ZIP (chall.yml + files, flags excluded)
func createChallengeZipFromDB(challengeID uint) ([]byte, error) {
	var buf bytes.Buffer
	zipWriter := zip.NewWriter(&buf)

	// Fetch challenge with all associations
	var challenge models.Challenge
	if err := config.DB.
		Preload("ChallengeCategory").
		Preload("ChallengeDifficulty").
		Preload("ChallengeType").
		Preload("Hints").
		Preload("DecayFormula").
		First(&challenge, challengeID).Error; err != nil {
		zipWriter.Close()
		return nil, fmt.Errorf("failed to fetch challenge: %w", err)
	}

	// Create chall.yml file (without flags for security)
	challYml, err := zipWriter.Create("chall.yml")
	if err != nil {
		zipWriter.Close()
		return nil, fmt.Errorf("failed to create chall.yml: %w", err)
	}

	// Build YAML content
	yamlContent := fmt.Sprintf("name: %s\n", challenge.Name)
	yamlContent += fmt.Sprintf("description: |\n  %s\n", strings.ReplaceAll(challenge.Description, "\n", "\n  "))

	if challenge.ChallengeCategory != nil {
		yamlContent += fmt.Sprintf("category: %s\n", challenge.ChallengeCategory.Name)
	}
	if challenge.ChallengeDifficulty != nil {
		yamlContent += fmt.Sprintf("difficulty: %s\n", challenge.ChallengeDifficulty.Name)
	}
	if challenge.ChallengeType != nil {
		yamlContent += fmt.Sprintf("type: %s\n", challenge.ChallengeType.Name)
	}
	if challenge.DecayFormula != nil {
		yamlContent += fmt.Sprintf("decay: \"%s\"\n", challenge.DecayFormula.Name)
	}

	yamlContent += fmt.Sprintf("author: %s\n", challenge.Author)
	yamlContent += "flags: [\"REDACTED\"]\n" // Don't include actual flags
	yamlContent += fmt.Sprintf("hidden: %t\n", challenge.Hidden)
	yamlContent += fmt.Sprintf("points: %d\n", challenge.Points)

	if challenge.MaxAttempts > 0 {
		yamlContent += fmt.Sprintf("attempts: %d\n", challenge.MaxAttempts)
	}

	if len(challenge.Ports) > 0 {
		yamlContent += "ports: ["
		for i, port := range challenge.Ports {
			if i > 0 {
				yamlContent += ", "
			}
			yamlContent += fmt.Sprintf("%d", port)
		}
		yamlContent += "]\n"
	}

	if challenge.CoverImg != "" {
		yamlContent += fmt.Sprintf("cover_img: %s\n", challenge.CoverImg)
	}

	if len(challenge.ConnectionInfo) > 0 {
		yamlContent += "connection_info: ["
		for i, info := range challenge.ConnectionInfo {
			if i > 0 {
				yamlContent += ", "
			}
			yamlContent += fmt.Sprintf("\"%s\"", info)
		}
		yamlContent += "]\n"
	}

	if _, err := challYml.Write([]byte(yamlContent)); err != nil {
		zipWriter.Close()
		return nil, fmt.Errorf("failed to write chall.yml: %w", err)
	}

	// Copy all challenge files from MinIO
	bucketName := "challenges"
	for _, fileName := range challenge.Files {
		objectPath := fmt.Sprintf("%s/%s", challenge.Slug, fileName)
		obj, err := config.FS.GetObject(context.Background(), bucketName, objectPath, minio.GetObjectOptions{})
		if err != nil {
			debug.Log("Skipping file %s (not found in MinIO): %v", fileName, err)
			continue
		}

		fileWriter, err := zipWriter.Create(fileName)
		if err != nil {
			obj.Close()
			debug.Log("Failed to create file %s in ZIP: %v", fileName, err)
			continue
		}

		if _, err := io.Copy(fileWriter, obj); err != nil {
			debug.Log("Failed to copy file %s to ZIP: %v", fileName, err)
		}
		obj.Close()
	}

	// Copy cover image if it exists (excluding processed versions)
	if challenge.CoverImg != "" {
		// Try to get the original cover image (not the processed _resized.webp version)
		originalCover := challenge.CoverImg
		if strings.Contains(originalCover, "_resized.webp") {
			// Try common extensions for the original
			for _, ext := range []string{".jpg", ".jpeg", ".png", ".webp", ".gif"} {
				baseName := strings.TrimSuffix(challenge.Slug, "/") + ext
				coverPath := fmt.Sprintf("%s/%s", challenge.Slug, baseName)
				obj, err := config.FS.GetObject(context.Background(), bucketName, coverPath, minio.GetObjectOptions{})
				if err == nil {
					fileWriter, err := zipWriter.Create(baseName)
					if err == nil {
						io.Copy(fileWriter, obj)
						obj.Close()
						break
					}
					obj.Close()
				}
			}
		} else {
			// Use the cover image as-is
			coverPath := fmt.Sprintf("%s/%s", challenge.Slug, challenge.CoverImg)
			obj, err := config.FS.GetObject(context.Background(), bucketName, coverPath, minio.GetObjectOptions{})
			if err == nil {
				fileWriter, err := zipWriter.Create(challenge.CoverImg)
				if err == nil {
					io.Copy(fileWriter, obj)
				}
				obj.Close()
			}
		}
	}

	// Finalize ZIP
	if err := zipWriter.Close(); err != nil {
		return nil, fmt.Errorf("failed to close zip writer: %w", err)
	}

	return buf.Bytes(), nil
}

func uploadFilesToMinIO(challengeSlug string, zipBytes []byte) error {
	zipFilename := fmt.Sprintf("%s.zip", challengeSlug)
	objectName := fmt.Sprintf("challenges/%s", zipFilename)

	_, err := config.FS.PutObject(
		context.Background(),
		bucketChallengeFiles,
		objectName,
		bytes.NewReader(zipBytes),
		int64(len(zipBytes)),
		minio.PutObjectOptions{ContentType: "application/zip"},
	)

	return err
}

// CreateChallenge creates a new challenge with optional file upload
func CreateChallenge(c *gin.Context) {
	// Initialize ZIP writer
	var zipBuffer bytes.Buffer
	zipWriter := zip.NewWriter(&zipBuffer)

	// Get and validate form
	form, err := c.MultipartForm()
	if err != nil {
		if err != http.ErrNotMultipart && err != http.ErrMissingBoundary {
			utils.BadRequestError(c, errInvalidMultipartForm)
			return
		}
	}

	// Process uploaded files into ZIP
	hasFiles, err := validateAndProcessFiles(form, zipWriter)
	if err != nil {
		if strings.Contains(err.Error(), "exceeds max size") {
			utils.BadRequestError(c, err.Error())
		} else {
			utils.InternalServerError(c, err.Error())
		}
		return
	}

	// Close ZIP writer
	if err := zipWriter.Close(); err != nil {
		utils.InternalServerError(c, err.Error())
		return
	}

	// Parse and validate metadata
	metaStr := c.PostForm(formFieldMeta)
	challenge, err := parseAndValidateMeta(metaStr)
	if err != nil {
		utils.BadRequestError(c, err.Error())
		return
	}

	// Create challenge in database
	result := config.DB.Create(challenge)
	if result.Error != nil {
		utils.InternalServerError(c, errChallengeCreationFailed)
		return
	}

	// Upload files to MinIO if any
	if hasFiles {
		zipBytes := zipBuffer.Bytes()
		if err := uploadFilesToMinIO(challenge.Slug, zipBytes); err != nil {
			config.DB.Delete(challenge)
			utils.InternalServerError(c, err.Error())
			return
		}
	}

	utils.CreatedResponse(c, *challenge)
}

// GetChallengeFirstBloods returns the first blood information for a challenge
func GetChallengeFirstBloods(c *gin.Context) {
	challengeIDStr := c.Param("id")

	var firstBloods []models.FirstBlood
	err := config.DB.Preload("Challenge").
		Preload("Team").
		Preload("User").
		Where("challenge_id = ?", challengeIDStr).
		Order("created_at ASC").
		Find(&firstBloods).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			utils.OKResponse(c, []models.FirstBlood{})
			return
		}
		utils.InternalServerError(c, err.Error())
		return
	}

	utils.OKResponse(c, firstBloods)
}
