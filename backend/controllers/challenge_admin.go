package controllers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/minio/minio-go/v7"
	"github.com/pwnthemall/pwnthemall/backend/config"
	"github.com/pwnthemall/pwnthemall/backend/debug"
	"github.com/pwnthemall/pwnthemall/backend/dto"
	"github.com/pwnthemall/pwnthemall/backend/models"
	"github.com/pwnthemall/pwnthemall/backend/utils"
	"gorm.io/gorm/clause"
)

const (
	queryChallengeIDAdmin   = "challenge_id = ?"
	errChallengeNotFoundMsg = "Challenge not found"
	queryNameEquals         = "name = ?"
)

// ExportChallenge downloads the challenge ZIP (files, cover, scripts) from MinIO
// If the export doesn't exist, it will be generated on-the-fly
func ExportChallenge(c *gin.Context) {
	var challenge models.Challenge
	id := c.Param("id")

	if err := config.DB.First(&challenge, id).Error; err != nil {
		utils.NotFoundError(c, errChallengeNotFoundMsg)
		return
	}

	objectName := fmt.Sprintf("challenges/%s.zip", challenge.Slug)
	obj, err := config.FS.GetObject(context.Background(), bucketChallengeFiles, objectName, minio.GetObjectOptions{})

	// If object doesn't exist, generate it on-the-fly
	if err != nil || obj == nil {
		debug.Log("Challenge export not found, generating on-the-fly for %s", challenge.Slug)

		// Generate ZIP
		zipBytes, err := createChallengeZipFromDB(challenge.ID)
		if err != nil {
			debug.Log("Failed to generate challenge export: %v", err)
			utils.InternalServerError(c, "Failed to generate challenge export")
			return
		}

		// Upload to MinIO for future use
		if err := uploadFilesToMinIO(challenge.Slug, zipBytes); err != nil {
			debug.Log("Failed to cache challenge export: %v", err)
		}

		// Stream directly to client
		c.Header("Content-Type", "application/zip")
		c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s.zip\"", challenge.Slug))
		c.Data(200, "application/zip", zipBytes)
		return
	}
	defer obj.Close()

	if _, err := obj.Stat(); err != nil {
		debug.Log("Challenge export stat failed %s, regenerating: %v", objectName, err)

		// Generate ZIP on-the-fly
		zipBytes, err := createChallengeZipFromDB(challenge.ID)
		if err != nil {
			debug.Log("Failed to generate challenge export: %v", err)
			utils.NotFoundError(c, "Challenge export not found")
			return
		}

		// Upload to MinIO for future use
		if err := uploadFilesToMinIO(challenge.Slug, zipBytes); err != nil {
			debug.Log("Failed to cache challenge export: %v", err)
		}

		// Stream directly to client
		c.Header("Content-Type", "application/zip")
		c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s.zip\"", challenge.Slug))
		c.Data(200, "application/zip", zipBytes)
		return
	}

	c.Header("Content-Type", "application/zip")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s.zip\"", challenge.Slug))

	if _, err := io.Copy(c.Writer, obj); err != nil {
		debug.Log("Failed to stream challenge export %s: %v", objectName, err)
	}
}

// CreateChallengeAdmin creates a new challenge for admins
// Supports standard and geo challenge types for "on the fly" creation during competitions
func CreateChallengeAdmin(c *gin.Context) {
	// Check if this is multipart form (with cover) or JSON only
	contentType := c.GetHeader("Content-Type")
	var req dto.ChallengeCreateRequest
	var coverFile *multipart.FileHeader
	var coverPositionX, coverPositionY float64 = 50, 50
	var coverZoom float64 = 100

	if strings.Contains(contentType, "multipart/form-data") {
		// Parse multipart form
		if err := c.Request.ParseMultipartForm(10 << 20); err != nil { // 10MB max
			utils.BadRequestError(c, "Failed to parse multipart form")
			return
		}

		// Get JSON metadata from form field
		metaJSON := c.PostForm("meta")
		if metaJSON == "" {
			utils.BadRequestError(c, "Missing metadata")
			return
		}

		if err := json.Unmarshal([]byte(metaJSON), &req); err != nil {
			utils.BadRequestError(c, "Invalid metadata JSON")
			return
		}

		// Get cover file if present
		file, err := c.FormFile("cover")
		if err == nil {
			coverFile = file

			// Get cover position and zoom
			if posX := c.PostForm("coverPositionX"); posX != "" {
				if val, err := strconv.ParseFloat(posX, 64); err == nil {
					coverPositionX = val
				}
			}
			if posY := c.PostForm("coverPositionY"); posY != "" {
				if val, err := strconv.ParseFloat(posY, 64); err == nil {
					coverPositionY = val
				}
			}
			if zoom := c.PostForm("coverZoom"); zoom != "" {
				if val, err := strconv.ParseFloat(zoom, 64); err == nil {
					coverZoom = val
				}
			}
		}
	} else {
		// Standard JSON request
		if err := c.ShouldBindJSON(&req); err != nil {
			utils.BadRequestError(c, err.Error())
			return
		}
	}

	// Validate geo fields if type is geo
	if req.Type == "geo" {
		if req.TargetLat == nil || req.TargetLng == nil || req.RadiusKm == nil {
			utils.BadRequestError(c, "geo challenges require targetLat, targetLng, and radiusKm")
			return
		}
		// Validate coordinate ranges
		if *req.TargetLat < -90 || *req.TargetLat > 90 {
			utils.BadRequestError(c, "targetLat must be between -90 and 90")
			return
		}
		if *req.TargetLng < -180 || *req.TargetLng > 180 {
			utils.BadRequestError(c, "targetLng must be between -180 and 180")
			return
		}
		if *req.RadiusKm <= 0 {
			utils.BadRequestError(c, "radiusKm must be greater than 0")
			return
		}
	}

	// Generate unique slug
	slug, err := utils.GenerateUniqueSlug(req.Name)
	if err != nil {
		utils.BadRequestError(c, err.Error())
		return
	}

	// Start transaction
	tx := config.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Create or get category
	category := models.ChallengeCategory{Name: req.Category}
	if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&category).Error; err != nil {
		tx.Rollback()
		utils.InternalServerError(c, "Failed to create category")
		return
	}
	if category.ID == 0 {
		if err := tx.Where(queryNameEquals, req.Category).First(&category).Error; err != nil {
			tx.Rollback()
			utils.InternalServerError(c, "Failed to find category")
			return
		}
	}

	// Create or get difficulty
	difficulty := models.ChallengeDifficulty{Name: req.Difficulty}
	if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&difficulty).Error; err != nil {
		tx.Rollback()
		utils.InternalServerError(c, "Failed to create difficulty")
		return
	}
	if difficulty.ID == 0 {
		if err := tx.Where(queryNameEquals, req.Difficulty).First(&difficulty).Error; err != nil {
			tx.Rollback()
			utils.InternalServerError(c, "Failed to find difficulty")
			return
		}
	}

	// Get challenge type
	var challengeType models.ChallengeType
	if err := tx.Where(queryNameEquals, req.Type).First(&challengeType).Error; err != nil {
		tx.Rollback()
		utils.BadRequestError(c, fmt.Sprintf("invalid challenge type: %s", req.Type))
		return
	}

	// Get default decay formula (No Decay)
	var decayFormula models.DecayFormula
	if err := tx.Where(queryNameEquals, "No Decay").First(&decayFormula).Error; err != nil {
		// If no decay formula found, just continue without it
		debug.Log("No decay formula found, continuing without")
	}

	// Create challenge
	challenge := models.Challenge{
		Slug:                  slug,
		Name:                  req.Name,
		Description:           req.Description,
		ChallengeCategoryID:   category.ID,
		ChallengeDifficultyID: difficulty.ID,
		ChallengeTypeID:       challengeType.ID,
		Points:                req.Points,
		Hidden:                req.Hidden,
		Author:                req.Author,
		CoverPositionX:        coverPositionX,
		CoverPositionY:        coverPositionY,
		CoverZoom:             coverZoom,
	}

	if decayFormula.ID > 0 {
		challenge.DecayFormulaID = decayFormula.ID
	}

	if err := tx.Create(&challenge).Error; err != nil {
		tx.Rollback()
		utils.InternalServerError(c, "Failed to create challenge")
		return
	}

	// Create flags (hashed)
	for _, flagValue := range req.Flags {
		hashed := utils.HashFlag(flagValue)
		flag := models.Flag{
			Value:       hashed,
			ChallengeID: challenge.ID,
		}
		if err := tx.Create(&flag).Error; err != nil {
			tx.Rollback()
			utils.InternalServerError(c, "Failed to create flag")
			return
		}
	}

	// Create hints if provided
	for _, hintReq := range req.Hints {
		hint := models.Hint{
			Title:       hintReq.Title,
			Content:     hintReq.Content,
			Cost:        hintReq.Cost,
			ChallengeID: challenge.ID,
			IsActive:    hintReq.IsActive,
			// AutoActiveAt parsing can be added later if needed
		}
		if err := tx.Create(&hint).Error; err != nil {
			tx.Rollback()
			utils.InternalServerError(c, "Failed to create hint")
			return
		}
	}

	// Create GeoSpec if geo challenge
	if req.Type == "geo" {
		geoSpec := models.GeoSpec{
			ChallengeID: challenge.ID,
			TargetLat:   *req.TargetLat,
			TargetLng:   *req.TargetLng,
			RadiusKm:    *req.RadiusKm,
		}
		if err := tx.Create(&geoSpec).Error; err != nil {
			tx.Rollback()
			utils.InternalServerError(c, "Failed to create geo spec")
			return
		}
	}

	// Commit transaction
	if err := tx.Commit().Error; err != nil {
		utils.InternalServerError(c, "Failed to commit transaction")
		return
	}

	// Process cover image if provided
	if coverFile != nil {
		debug.Log("Processing cover image for challenge %d: %s", challenge.ID, coverFile.Filename)

		// Open the uploaded file
		file, err := coverFile.Open()
		if err != nil {
			debug.Log("Failed to open cover file: %v", err)
		} else {
			defer file.Close()

			// Read file data
			fileData, err := io.ReadAll(file)
			if err != nil {
				debug.Log("Failed to read cover file: %v", err)
			} else {
				// Store original in MinIO
				bucketName := "challenges"
				originalPath := fmt.Sprintf("%s/%s", challenge.Slug, coverFile.Filename)

				// Detect content type from filename
				contentType := "image/jpeg"
				filename := strings.ToLower(coverFile.Filename)
				if strings.HasSuffix(filename, ".png") {
					contentType = "image/png"
				} else if strings.HasSuffix(filename, ".gif") {
					contentType = "image/gif"
				} else if strings.HasSuffix(filename, ".webp") {
					contentType = "image/webp"
				}

				_, err = config.FS.PutObject(
					context.Background(),
					bucketName,
					originalPath,
					bytes.NewReader(fileData),
					int64(len(fileData)),
					minio.PutObjectOptions{
						ContentType: contentType,
					},
				)

				if err != nil {
					debug.Log("Failed to store cover image: %v", err)
				} else {
					// Process image (resize, validate, etc)
					processedPath, err := utils.ProcessChallengeCoverImage(context.Background(), challenge.Slug, coverFile.Filename)
					if err != nil {
						debug.Log("Failed to process cover image: %v", err)
					} else {
						// Update challenge with cover path
						challenge.CoverImg = processedPath
						config.DB.Model(&challenge).Update("cover_img", processedPath)
						debug.Log("Cover image processed successfully: %s", processedPath)
					}
				}
			}
		}
	}

	// Create and upload challenge ZIP to MinIO for export functionality
	if zipBytes, err := createChallengeZipFromDB(challenge.ID); err != nil {
		debug.Log("Failed to create challenge ZIP for export: %v", err)
	} else {
		if err := uploadFilesToMinIO(challenge.Slug, zipBytes); err != nil {
			debug.Log("Failed to upload challenge ZIP to MinIO: %v", err)
		} else {
			debug.Log("Successfully created and uploaded challenge ZIP for export")
		}
	}

	// Broadcast challenge creation
	broadcastChallengeUpdate()

	// Reload challenge with associations
	config.DB.Preload("ChallengeCategory").Preload("ChallengeDifficulty").Preload("ChallengeType").First(&challenge, challenge.ID)

	debug.Log("Created challenge: ID=%d, Slug=%s, Name=%s, Type=%s", challenge.ID, challenge.Slug, challenge.Name, req.Type)

	utils.CreatedResponse(c, challenge)
}

// updateChallengeFields updates the basic challenge fields from the request
func updateChallengeFields(challenge *models.Challenge, req *dto.ChallengeAdminUpdateRequest) {
	if req.Points != nil {
		challenge.Points = *req.Points
	}
	if req.DecayFormulaID != nil {
		challenge.DecayFormulaID = *req.DecayFormulaID
	}
	if req.EnableFirstBlood != nil {
		challenge.EnableFirstBlood = *req.EnableFirstBlood
	}

	if req.FirstBloodBonuses != nil && len(*req.FirstBloodBonuses) > 0 {
		challenge.FirstBloodBonuses = *req.FirstBloodBonuses
	} else if req.FirstBloodBonuses != nil {
		challenge.FirstBloodBonuses = []int64{}
	}

	if req.FirstBloodBadges != nil && len(*req.FirstBloodBadges) > 0 {
		challenge.FirstBloodBadges = *req.FirstBloodBadges
	} else if req.FirstBloodBadges != nil {
		challenge.FirstBloodBadges = []string{}
	}
}

// broadcastChallengeUpdate sends WebSocket notification for challenge update
func broadcastChallengeUpdate() {
	if utils.UpdatesHub != nil {
		if payload, err := json.Marshal(gin.H{
			"event":  "challenge-category",
			"action": "challenge_update",
		}); err == nil {
			utils.UpdatesHub.SendToAll(payload)
		}
	}
}

// processHintsFromRequest creates or updates hints based on the request
func processHintsFromRequest(challengeID uint, hints *[]models.Hint) {
	if hints == nil {
		return
	}

	for _, hintReq := range *hints {
		debug.Log("Processing hint: ID=%d, Title=%s, Content=%s, Cost=%d", hintReq.ID, hintReq.Title, hintReq.Content, hintReq.Cost)

		if hintReq.ID > 0 {
			// Update existing hint
			var hint models.Hint
			if err := config.DB.First(&hint, hintReq.ID).Error; err == nil {
				hint.Title = hintReq.Title
				hint.Content = hintReq.Content
				hint.Cost = hintReq.Cost
				hint.IsActive = hintReq.IsActive
				hint.AutoActiveAt = hintReq.AutoActiveAt
				if err := config.DB.Save(&hint).Error; err != nil {
					debug.Log("Failed to update hint %d: %v", hint.ID, err)
				} else {
					debug.Log("Successfully updated hint %d", hint.ID)
				}
			}
		} else if hintReq.Content != "" {
			// Create new hint
			hint := models.Hint{
				ChallengeID:  challengeID,
				Title:        hintReq.Title,
				Content:      hintReq.Content,
				Cost:         hintReq.Cost,
				IsActive:     hintReq.IsActive,
				AutoActiveAt: hintReq.AutoActiveAt,
			}
			if err := config.DB.Create(&hint).Error; err != nil {
				debug.Log("Failed to create hint: %v", err)
			} else {
				debug.Log("Successfully created hint: ID=%d, Title=%s", hint.ID, hint.Title)
			}
		}
	}
}

// cleanupFirstBloodIfDisabled removes first blood entries if feature is disabled
func cleanupFirstBloodIfDisabled(req *dto.ChallengeAdminUpdateRequest, challenge *models.Challenge) {
	if req.EnableFirstBlood != nil && !*req.EnableFirstBlood && challenge.EnableFirstBlood {
		config.DB.Where("challenge_id = ?", challenge.ID).Delete(&models.FirstBlood{})
	}
}

func UpdateChallengeAdmin(c *gin.Context) {
	var challenge models.Challenge
	id := c.Param("id")

	if err := config.DB.First(&challenge, id).Error; err != nil {
		utils.NotFoundError(c, errChallengeNotFoundMsg)
		return
	}

	var req dto.ChallengeAdminUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequestError(c, err.Error())
		return
	}

	updateChallengeFields(&challenge, &req)

	if err := config.DB.Save(&challenge).Error; err != nil {
		utils.InternalServerError(c, "Failed to update challenge")
		return
	}

	broadcastChallengeUpdate()

	recalculateChallengePoints(challenge.ID)

	cleanupFirstBloodIfDisabled(&req, &challenge)

	processHintsFromRequest(challenge.ID, req.Hints)

	// Reload challenge with associations
	if err := config.DB.Preload("DecayFormula").Preload("Hints").Preload("FirstBlood").First(&challenge, challenge.ID).Error; err != nil {
		debug.Log("Failed to reload challenge: %v", err)
	} else {
		debug.Log("Reloaded challenge %d with %d hints", challenge.ID, len(challenge.Hints))
		for i, hint := range challenge.Hints {
			debug.Log("Hint %d: ID=%d, Title=%s, Content=%s", i, hint.ID, hint.Title, hint.Content)
		}
	}

	// Create and upload updated challenge ZIP to MinIO for export
	if zipBytes, err := createChallengeZipFromDB(challenge.ID); err != nil {
		debug.Log("Failed to create challenge ZIP for export: %v", err)
	} else {
		if err := uploadFilesToMinIO(challenge.Slug, zipBytes); err != nil {
			debug.Log("Failed to upload challenge ZIP to MinIO: %v", err)
		} else {
			debug.Log("Successfully created and uploaded updated challenge ZIP for export")
		}
	}

	utils.OKResponse(c, challenge)
}

func UpdateChallengeGeneralAdmin(c *gin.Context) {
	var challenge models.Challenge
	id := c.Param("id")

	if err := config.DB.First(&challenge, id).Error; err != nil {
		utils.NotFoundError(c, errChallengeNotFoundMsg)
		return
	}

	var req dto.ChallengeGeneralUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequestError(c, err.Error())
		return
	}

	// Update challenge general fields
	challenge.Name = req.Name
	challenge.Description = req.Description
	challenge.Author = req.Author
	challenge.Hidden = *req.Hidden
	challenge.ChallengeCategoryID = *req.CategoryID
	challenge.ChallengeDifficultyID = *req.DifficultyID

	// Update cover position if provided
	if req.CoverPositionX != nil {
		challenge.CoverPositionX = *req.CoverPositionX
	}
	if req.CoverPositionY != nil {
		challenge.CoverPositionY = *req.CoverPositionY
	}
	if req.CoverZoom != nil {
		challenge.CoverZoom = *req.CoverZoom
	}

	if err := config.DB.Save(&challenge).Error; err != nil {
		utils.InternalServerError(c, "Failed to update challenge")
		return
	}

	// Broadcast category update (challenge modified affects category)
	if utils.UpdatesHub != nil {
		if payload, err := json.Marshal(gin.H{
			"event":  "challenge-category",
			"action": "challenge_update",
		}); err == nil {
			utils.UpdatesHub.SendToAll(payload)
		}
	}

	// Create and upload updated challenge ZIP to MinIO for export functionality
	if zipBytes, err := createChallengeZipFromDB(challenge.ID); err != nil {
		debug.Log("Failed to create challenge ZIP for export: %v", err)
	} else {
		if err := uploadFilesToMinIO(challenge.Slug, zipBytes); err != nil {
			debug.Log("Failed to upload challenge ZIP to MinIO: %v", err)
		} else {
			debug.Log("Successfully created and uploaded updated challenge ZIP for export")
		}
	}

	utils.OKResponse(c, challenge)
}

func GetChallengeAdmin(c *gin.Context) {
	var challenge models.Challenge
	id := c.Param("id")

	if err := config.DB.Preload("DecayFormula").Preload("Hints").Preload("FirstBlood").First(&challenge, id).Error; err != nil {
		utils.NotFoundError(c, errChallengeNotFoundMsg)
		return
	}

	debug.Log("GetChallengeAdmin: Challenge %d has %d hints", challenge.ID, len(challenge.Hints))
	for i, hint := range challenge.Hints {
		debug.Log("Hint %d: ID=%d, Title=%s, Content=%s", i, hint.ID, hint.Title, hint.Content)
	}

	var decayFormulas []models.DecayFormula
	config.DB.Find(&decayFormulas)

	var challengeDifficulties []models.ChallengeDifficulty
	config.DB.Find(&challengeDifficulties)

	response := gin.H{
		"challenge":             challenge,
		"decayFormulas":         decayFormulas,
		"challengeDifficulties": challengeDifficulties,
	}

	utils.OKResponse(c, response)
}

func GetAllChallengesAdmin(c *gin.Context) {
	var challenges []models.Challenge
	if err := config.DB.Preload("ChallengeCategory").Preload("ChallengeType").Preload("ChallengeDifficulty").Preload("Hints").Find(&challenges).Error; err != nil {
		utils.InternalServerError(c, err.Error())
		return
	}

	utils.OKResponse(c, challenges)
}

func DeleteHint(c *gin.Context) {
	hintID := c.Param("hintId")

	if err := config.DB.Delete(&models.Hint{}, hintID).Error; err != nil {
		utils.InternalServerError(c, "Failed to delete hint")
		return
	}

	utils.OKResponse(c, gin.H{"message": "Hint deleted successfully"})
}

// recalculateChallengePoints recalculates points for all solves of a specific challenge
func recalculateChallengePoints(challengeID uint) {
	decayService := utils.NewDecay()

	// Get the challenge details
	var challenge models.Challenge
	if err := config.DB.First(&challenge, challengeID).Error; err != nil {
		debug.Log("Failed to fetch challenge %d for recalculation: %v", challengeID, err)
		return
	}

	// Delete existing FirstBlood entries for this challenge and recreate them
	if err := config.DB.Where("challenge_id = ?", challengeID).Delete(&models.FirstBlood{}).Error; err != nil {
		debug.Log("Failed to delete existing FirstBlood entries: %v", err)
	}

	// Get all solves for this challenge, ordered by creation time
	var solves []models.Solve
	if err := config.DB.Where("challenge_id = ?", challengeID).Order("created_at ASC").Find(&solves).Error; err != nil {
		debug.Log("Failed to fetch solves for challenge %d: %v", challengeID, err)
		return
	}

	// Recalculate points for each solve based on its position
	for i, solve := range solves {
		position := i
		newPoints := decayService.CalculateDecayedPoints(&challenge, position)

		// Add FirstBlood bonus if applicable
		firstBloodBonus := 0
		if challenge.EnableFirstBlood && len(challenge.FirstBloodBonuses) > 0 {
			if position < len(challenge.FirstBloodBonuses) {
				firstBloodBonus = int(challenge.FirstBloodBonuses[position])

				// Create FirstBlood entry
				badge := "trophy" // default badge
				if position < len(challenge.FirstBloodBadges) {
					badge = challenge.FirstBloodBadges[position]
				}

				firstBlood := models.FirstBlood{
					ChallengeID: challengeID,
					TeamID:      solve.TeamID,
					UserID:      solve.UserID,
					Bonuses:     []int64{int64(firstBloodBonus)},
					Badges:      []string{badge},
				}

				if err := config.DB.Create(&firstBlood).Error; err != nil {
					debug.Log("Failed to recreate FirstBlood entry: %v", err)
				}
			}
		}

		newPointsWithBonus := newPoints + firstBloodBonus

		if solve.Points != newPointsWithBonus {
			solve.Points = newPointsWithBonus
			if err := config.DB.Save(&solve).Error; err != nil {
				debug.Log("Failed to update solve for team %d, challenge %d: %v", solve.TeamID, solve.ChallengeID, err)
			} else {
				debug.Log("Updated solve points for team %d, challenge %d: %d -> %d (decay: %d, firstblood: %d)",
					solve.TeamID, solve.ChallengeID, solve.Points, newPointsWithBonus, newPoints, firstBloodBonus)
			}
		}
	}
}
