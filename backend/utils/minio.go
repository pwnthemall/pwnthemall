package utils

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"

	"github.com/pwnthemall/pwnthemall/backend/debug"

	"os"
	"path/filepath"
	"reflect"
	"strings"
	"time"

	"github.com/pwnthemall/pwnthemall/backend/config"
	"github.com/pwnthemall/pwnthemall/backend/meta"
	"github.com/pwnthemall/pwnthemall/backend/models"

	"github.com/lib/pq"
	"github.com/minio/minio-go/v7"
	"gopkg.in/yaml.v2"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	bucketNameChallenges  = "challenges"
	bucketNamePages       = "pages"
	querySlug             = "slug = ?"
	queryChallengeIDMinio = "challenge_id = ?"
)

// parseObjectKey extracts the actual object key from webhook payload
func parseObjectKey(key string) string {
	parts := strings.SplitN(key, "/", 2)
	if len(parts) == 2 {
		// Strip bucket name prefix if present (e.g., "challenges/..." or "pages/...")
		if parts[0] == bucketNameChallenges || parts[0] == bucketNamePages {
			return parts[1]
		}
	}
	return key
}

// retrieveAndValidateObject fetches object from MinIO and validates it exists
func retrieveAndValidateObject(ctx context.Context, bucketName string, objectKey string) (*minio.Object, error) {
	time.Sleep(500 * time.Millisecond)
	obj, err := config.FS.GetObject(ctx, bucketName, objectKey, minio.GetObjectOptions{})
	if err != nil {
		return nil, err
	}

	if _, statErr := obj.Stat(); statErr != nil {
		obj.Close()
		return nil, statErr
	}

	return obj, nil
}

// readObjectContent reads the full content of a MinIO object
func readObjectContent(obj *minio.Object) (*bytes.Buffer, error) {
	buf := new(bytes.Buffer)
	if _, err := buf.ReadFrom(obj); err != nil {
		return nil, err
	}
	return buf, nil
}

// parseDockerChallenge parses Docker challenge metadata
func parseDockerChallenge(content []byte) (meta.BaseChallengeMetadata, []int, error) {
	var dockerMeta meta.DockerChallengeMetadata
	if err := yaml.Unmarshal(content, &dockerMeta); err != nil {
		return meta.BaseChallengeMetadata{}, nil, err
	}
	return dockerMeta.Base, dockerMeta.Ports, nil
}

// parseComposeChallenge parses Compose challenge metadata
func parseComposeChallenge(content []byte) (meta.BaseChallengeMetadata, []int, error) {
	var composeMeta meta.ComposeChallengeMetadata
	if err := yaml.Unmarshal(content, &composeMeta); err != nil {
		return meta.BaseChallengeMetadata{}, nil, err
	}
	return composeMeta.Base, composeMeta.Ports, nil
}

// saveGeoSpecForChallenge saves GeoSpec data for geo challenges
func saveGeoSpecForChallenge(slug string, geoMeta meta.GeoChallengeMetadata) {
	var challenge models.Challenge
	if err := config.DB.Where(querySlug, slug).First(&challenge).Error; err != nil {
		return
	}

	var existing models.GeoSpec
	if err := config.DB.Where(queryChallengeIDMinio, challenge.ID).First(&existing).Error; err == nil {
		existing.TargetLat = geoMeta.TargetLat
		existing.TargetLng = geoMeta.TargetLng
		existing.RadiusKm = geoMeta.RadiusKm
		_ = config.DB.Save(&existing).Error
	} else {
		gs := models.GeoSpec{
			ChallengeID: challenge.ID,
			TargetLat:   geoMeta.TargetLat,
			TargetLng:   geoMeta.TargetLng,
			RadiusKm:    geoMeta.RadiusKm,
		}
		_ = config.DB.Create(&gs).Error
	}
}

// parseGeoChallenge parses Geo challenge metadata
func parseGeoChallenge(content []byte, objectKey string) (meta.BaseChallengeMetadata, []int, *meta.GeoChallengeMetadata, error) {
	var geoMeta meta.GeoChallengeMetadata
	if err := yaml.Unmarshal(content, &geoMeta); err != nil {
		return meta.BaseChallengeMetadata{}, nil, nil, err
	}

	// Parse as compose to get base metadata
	var composeMeta meta.ComposeChallengeMetadata
	if err := yaml.Unmarshal(content, &composeMeta); err != nil {
		return meta.BaseChallengeMetadata{}, nil, nil, err
	}

	// Return geoMeta so it can be saved AFTER challenge creation
	return composeMeta.Base, nil, &geoMeta, nil
}

// parseChallengeByType parses challenge metadata based on type
func parseChallengeByType(base meta.BaseChallengeMetadata, content []byte, objectKey string) (meta.BaseChallengeMetadata, []int, *meta.GeoChallengeMetadata, error) {
	switch base.Type {
	case "docker":
		baseData, ports, err := parseDockerChallenge(content)
		return baseData, ports, nil, err
	case "compose":
		baseData, ports, err := parseComposeChallenge(content)
		return baseData, ports, nil, err
	case "geo":
		return parseGeoChallenge(content, objectKey)
	default:
		return base, nil, nil, nil
	}
}

// SyncAllChallengesFromMinIO syncs all challenges from MinIO on startup
func SyncAllChallengesFromMinIO(ctx context.Context, updatesHub *Hub) error {
	debug.Log("Starting initial sync of all challenges from MinIO bucket: %s", bucketNameChallenges)

	// List all objects in the challenges bucket
	objectCh := config.FS.ListObjects(ctx, bucketNameChallenges, minio.ListObjectsOptions{
		Recursive: true,
	})

	syncCount := 0
	errorCount := 0

	for object := range objectCh {
		if object.Err != nil {
			debug.Log("Error listing object: %v", object.Err)
			errorCount++
			continue
		}

		// Only sync chall.yml files
		if filepath.Base(object.Key) != "chall.yml" {
			continue
		}

		// Sync this challenge
		key := bucketNameChallenges + "/" + object.Key
		if err := SyncChallengesFromMinIO(ctx, key, updatesHub); err != nil {
			debug.Log("Error syncing %s: %v", object.Key, err)
			errorCount++
		} else {
			syncCount++
		}
	}

	debug.Log("Initial sync completed: %d challenges synced, %d errors", syncCount, errorCount)
	return nil
}

func SyncChallengesFromMinIO(ctx context.Context, key string, updatesHub *Hub) error {
	objectKey := parseObjectKey(key)
	debug.Log("SyncChallengesFromMinIO begin for bucket: %s, key: %s", bucketNameChallenges, objectKey)

	// Try to retrieve and validate object
	obj, err := retrieveAndValidateObject(ctx, bucketNameChallenges, objectKey)
	if err != nil {
		debug.Log("Object not found or error retrieving object %s: %v", objectKey, err)
		slug := strings.Split(objectKey, "/")[0]
		if err := deleteChallengeFromDB(slug); err != nil {
			debug.Log("Error deleting challenge from DB: %v", err)
			return err
		}
		debug.Log("Deleted challenge with slug %s from DB", slug)
		return nil
	}
	defer obj.Close()

	// Read object content
	buf, err := readObjectContent(obj)
	if err != nil {
		debug.Log("Error reading object %s: %v", objectKey, err)
		return err
	}

	// Parse base metadata to determine type
	var base meta.BaseChallengeMetadata
	if err := yaml.Unmarshal(buf.Bytes(), &base); err != nil {
		debug.Log("Invalid YAML for %s: %v", objectKey, err)
		return err
	}

	// Parse type-specific metadata
	metaData, ports, geoMeta, err := parseChallengeByType(base, buf.Bytes(), objectKey)
	if err != nil {
		debug.Log("Error parsing challenge metadata: %v", err)
		return err
	}

	// Update or create the challenge in the database
	slug := strings.Split(objectKey, "/")[0]
	if err := updateOrCreateChallengeInDB(metaData, slug, ports, updatesHub); err != nil {
		debug.Log("Error updating or creating challenge in DB: %v", err)
		return err
	}

	// Save GeoSpec AFTER challenge is created
	if geoMeta != nil {
		saveGeoSpecForChallenge(slug, *geoMeta)
	}

	debug.Log("Synced %s to DB", objectKey)
	return nil
}

func deleteChallengeFromDB(slug string) error {
	var challenge models.Challenge
	if err := config.DB.Where("slug = ?", slug).Delete(&challenge).Error; err != nil {
		return err
	}
	return nil
}

// createOrGetEntity creates entity if not exists, otherwise gets existing
func createOrGetEntity(dest interface{}, where map[string]interface{}) error {
	result := config.DB.Clauses(clause.OnConflict{DoNothing: true}).Create(dest)
	if result.Error != nil {
		return result.Error
	}

	idField := reflect.Indirect(reflect.ValueOf(dest)).FieldByName("ID")
	if idField.Uint() == 0 {
		return config.DB.Where(where).First(dest).Error
	}

	return nil
}

// createChallengeRelatedEntities creates or retrieves category, difficulty, type, decay formula
func createChallengeRelatedEntities(metaData meta.BaseChallengeMetadata) (uint, uint, *models.ChallengeType, *models.DecayFormula, error) {
	cCategory := models.ChallengeCategory{Name: metaData.Category}
	if err := createOrGetEntity(&cCategory, map[string]interface{}{"name": metaData.Category}); err != nil {
		return 0, 0, nil, nil, err
	}

	cDifficulty := models.ChallengeDifficulty{Name: metaData.Difficulty}
	if err := createOrGetEntity(&cDifficulty, map[string]interface{}{"name": metaData.Difficulty}); err != nil {
		return 0, 0, nil, nil, err
	}

	cType := models.ChallengeType{Name: metaData.Type}
	if err := createOrGetEntity(&cType, map[string]interface{}{"name": metaData.Type}); err != nil {
		return 0, 0, nil, nil, err
	}

	// Get decay formula - default to "No Decay" if not specified or not found
	var cDecayFormula models.DecayFormula
	decayFormulaName := metaData.DecayFormula
	if decayFormulaName == "" || decayFormulaName == "None" {
		decayFormulaName = "No Decay"
	}
	if err := config.DB.Where("name = ?", decayFormulaName).First(&cDecayFormula).Error; err != nil {
		// If specified formula not found, use "No Decay" as fallback
		if err := config.DB.Where("name = ?", "No Decay").First(&cDecayFormula).Error; err != nil {
			return 0, 0, nil, nil, err
		}
	}

	return cCategory.ID, cDifficulty.ID, &cType, &cDecayFormula, nil
}

// populateBasicChallengeFields sets basic challenge fields from metadata
func populateBasicChallengeFields(challenge *models.Challenge, metaData meta.BaseChallengeMetadata, slug string, categoryID uint, difficultyID uint, cType *models.ChallengeType, decayFormula *models.DecayFormula, isNewChallenge bool) {
	challenge.Slug = slug
	challenge.Name = metaData.Name
	challenge.Description = metaData.Description
	challenge.ChallengeDifficultyID = difficultyID
	challenge.ChallengeCategoryID = categoryID
	challenge.ChallengeTypeID = cType.ID
	challenge.ChallengeType = cType
	challenge.Author = metaData.Author
	challenge.Hidden = metaData.Hidden
	challenge.Points = metaData.Points
	challenge.MaxAttempts = metaData.Attempts
	challenge.DependsOn = metaData.DependsOn
	challenge.Emoji = metaData.Emoji

	// Only set decay formula if:
	// 1. It's a new challenge, OR
	// 2. The YAML file explicitly specifies a decay formula (not empty/None)
	if isNewChallenge || (metaData.DecayFormula != "" && metaData.DecayFormula != "None") {
		challenge.DecayFormula = decayFormula
		challenge.DecayFormulaID = decayFormula.ID
	}
	// If it's an existing challenge and YAML doesn't specify decay, preserve existing decay formula
}

// setChallengePorts converts and sets port array
func setChallengePorts(challenge *models.Challenge, ports []int) {
	ports64 := make(pq.Int64Array, len(ports))
	for i, p := range ports {
		ports64[i] = int64(p)
	}
	challenge.Ports = ports64
}

// setConnectionInfo sets connection info array
func setConnectionInfo(challenge *models.Challenge, connectionInfo []string) {
	if len(connectionInfo) > 0 {
		connInfo := make(pq.StringArray, len(connectionInfo))
		copy(connInfo, connectionInfo)
		challenge.ConnectionInfo = connInfo
	} else {
		challenge.ConnectionInfo = pq.StringArray{}
	}
}

// setFirstBloodConfig sets first blood bonuses and badges
func setFirstBloodConfig(challenge *models.Challenge, firstBlood *meta.FirstBloodMetadata) {
	challenge.EnableFirstBlood = firstBlood != nil && len(firstBlood.Bonuses) > 0

	if firstBlood == nil {
		challenge.FirstBloodBonuses = pq.Int64Array{}
		challenge.FirstBloodBadges = pq.StringArray{}
		return
	}

	if len(firstBlood.Bonuses) > 0 {
		bonuses64 := make(pq.Int64Array, len(firstBlood.Bonuses))
		for i, bonus := range firstBlood.Bonuses {
			bonuses64[i] = int64(bonus)
		}
		challenge.FirstBloodBonuses = bonuses64
	} else {
		challenge.FirstBloodBonuses = pq.Int64Array{}
	}

	if len(firstBlood.Badges) > 0 {
		badgesArray := make(pq.StringArray, len(firstBlood.Badges))
		copy(badgesArray, firstBlood.Badges)
		challenge.FirstBloodBadges = badgesArray
	} else {
		challenge.FirstBloodBadges = pq.StringArray{}
	}
}

// syncFlags removes old flags and creates new ones
func syncFlags(challengeID uint, flags []string) error {
	if err := config.DB.Where(queryChallengeIDMinio, challengeID).Delete(&models.Flag{}).Error; err != nil {
		return err
	}

	for _, flagValue := range flags {
		hashed := HashFlag(flagValue)
		newFlag := models.Flag{
			Value:       hashed,
			ChallengeID: challengeID,
		}
		if err := config.DB.Create(&newFlag).Error; err != nil {
			return err
		}
	}

	return nil
}

// syncHints removes old hints and creates new ones
func syncHints(challengeID uint, hints []meta.HintMetadata) error {
	if len(hints) == 0 {
		return nil
	}

	if err := config.DB.Where(queryChallengeIDMinio, challengeID).Delete(&models.Hint{}).Error; err != nil {
		return err
	}

	for _, hintMeta := range hints {
		isActive := true
		if hintMeta.IsActive != nil {
			isActive = *hintMeta.IsActive
		}

		hint := models.Hint{
			ChallengeID: challengeID,
			Title:       hintMeta.Title,
			Content:     hintMeta.Content,
			Cost:        hintMeta.Cost,
			IsActive:    isActive,
		}

		if hintMeta.AutoActiveAt != nil {
			if autoActiveTime, err := time.Parse(time.RFC3339, *hintMeta.AutoActiveAt); err == nil {
				hint.AutoActiveAt = &autoActiveTime
			}
		}

		if err := config.DB.Select("ChallengeID", "Title", "Content", "Cost", "IsActive", "AutoActiveAt").Create(&hint).Error; err != nil {
			return err
		}
	}

	return nil
}

// setChallengeFiles validates and sets the files list for a challenge
func setChallengeFiles(challenge *models.Challenge, files []string, slug string) error {
	if len(files) == 0 {
		challenge.Files = []string{}
		return nil
	}

	const maxFileSize = 50 * 1024 * 1024   // 50MB per file
	const maxTotalSize = 200 * 1024 * 1024 // 200MB total
	var totalSize int64

	validFiles := make([]string, 0, len(files))
	bucketName := "challenges"

	for _, fileName := range files {
		// Sanitize path
		cleanPath := filepath.Clean(fileName)
		if strings.HasPrefix(cleanPath, "..") || filepath.IsAbs(cleanPath) {
			return fmt.Errorf("invalid file path: %s (path traversal attempt)", fileName)
		}

		// Construct object path
		objectPath := fmt.Sprintf("%s/%s", slug, cleanPath)

		// Verify file exists in MinIO
		obj, err := config.FS.StatObject(context.Background(), bucketName, objectPath, minio.StatObjectOptions{})
		if err != nil {
			return fmt.Errorf("file not found in MinIO: %s", fileName)
		}

		// Check file size
		if obj.Size > maxFileSize {
			return fmt.Errorf("file %s exceeds maximum size (50MB)", fileName)
		}

		totalSize += obj.Size
		validFiles = append(validFiles, fileName)
	}

	// Check total size
	if totalSize > maxTotalSize {
		return fmt.Errorf("total file size exceeds maximum (200MB)")
	}

	challenge.Files = validFiles
	return nil
}

func updateOrCreateChallengeInDB(metaData meta.BaseChallengeMetadata, slug string, ports []int, updatesHub *Hub) error {
	// Create or get related entities
	categoryID, difficultyID, cType, decayFormula, err := createChallengeRelatedEntities(metaData)
	if err != nil {
		return err
	}

	// Load or create challenge
	var challenge models.Challenge
	isNewChallenge := false
	if err := config.DB.Where(querySlug, slug).First(&challenge).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			isNewChallenge = true
		} else {
			return err
		}
	}

	// Populate challenge fields
	populateBasicChallengeFields(&challenge, metaData, slug, categoryID, difficultyID, cType, decayFormula, isNewChallenge)
	setChallengePorts(&challenge, ports)
	setConnectionInfo(&challenge, metaData.ConnectionInfo)
	challenge.EnableFirstBlood = metaData.EnableFirstBlood
	setFirstBloodConfig(&challenge, metaData.FirstBlood)

	// Set challenge files
	if err := setChallengeFiles(&challenge, metaData.Files, slug); err != nil {
		return fmt.Errorf("failed to set challenge files: %w", err)
	}

	// Process cover image if specified
	coverImgPath := ""
	if metaData.CoverImg != "" {
		ctx := context.Background()
		if processedPath, err := ProcessChallengeCoverImage(ctx, slug, metaData.CoverImg); err != nil {
			debug.Log("Warning: Failed to process cover image for %s: %v", slug, err)
			// Don't fail sync - challenge still works without cover image
		} else {
			coverImgPath = processedPath
			debug.Log("Successfully processed cover image for %s: %s", slug, coverImgPath)
		}
	}
	challenge.CoverImg = coverImgPath

	// Save challenge
	if err := config.DB.Save(&challenge).Error; err != nil {
		return err
	}

	// Broadcast update
	if updatesHub != nil {
		if payload, err := json.Marshal(map[string]interface{}{
			"event":  "challenge-category",
			"action": "minio_sync",
		}); err == nil {
			updatesHub.SendToAll(payload)
		}
	}

	// Sync flags and hints
	if err := syncFlags(challenge.ID, metaData.Flags); err != nil {
		return err
	}

	if err := syncHints(challenge.ID, metaData.Hints); err != nil {
		return err
	}

	return nil
}

func RetrieveFileContentFromMinio(path string) ([]byte, error) {
	const bucketName = bucketNameChallenges
	object, err := config.FS.GetObject(context.Background(), bucketName, path, minio.GetObjectOptions{})
	if err != nil {
		debug.Println(err)
		return nil, err
	}
	defer object.Close()

	content, err := io.ReadAll(object)
	if err != nil {
		debug.Println(err)
		return nil, err
	}

	debug.Log("File %s retrieved on MinIO", path)
	return content, nil
}

func DownloadChallengeContext(slug string, localDir string) error {
	const bucketName = "challenges"
	ctx := context.Background()

	opts := minio.ListObjectsOptions{
		Prefix:    slug + "/",
		Recursive: true,
	}

	for obj := range config.FS.ListObjects(ctx, bucketName, opts) {
		if obj.Err != nil {
			return obj.Err
		}
		localPath := filepath.Join(localDir, obj.Key[len(slug)+1:])
		if err := os.MkdirAll(filepath.Dir(localPath), 0755); err != nil {
			return err
		}
		reader, err := config.FS.GetObject(ctx, bucketName, obj.Key, minio.GetObjectOptions{})
		if err != nil {
			return err
		}
		defer reader.Close()

		outFile, err := os.Create(localPath)
		if err != nil {
			return err
		}
		if _, err := io.Copy(outFile, reader); err != nil {
			return err
		}
		outFile.Close()
	}
	return nil
}

// SyncAllPagesFromMinIO syncs all pages from MinIO on startup
func SyncAllPagesFromMinIO(ctx context.Context) error {
	debug.Log("Starting initial sync of all pages from MinIO bucket: %s", bucketNamePages)

	// List all objects in the pages bucket
	objectCh := config.FS.ListObjects(ctx, bucketNamePages, minio.ListObjectsOptions{
		Recursive: true,
	})

	syncCount := 0
	errorCount := 0

	for object := range objectCh {
		if object.Err != nil {
			debug.Log("Error listing pages: %v", object.Err)
			errorCount++
			continue
		}

		// Only sync page.yml files
		if !strings.HasSuffix(object.Key, "/page.yml") {
			continue
		}

		// Sync this page
		if err := SyncPagesFromMinIO(ctx, object.Key, nil); err != nil {
			debug.Log("Failed to sync page %s: %v", object.Key, err)
			errorCount++
		} else {
			syncCount++
		}
	}

	debug.Log("Initial page sync completed: %d pages synced, %d errors", syncCount, errorCount)
	return nil
}

// SyncPagesFromMinIO syncs a single page from MinIO (triggered by webhook or manual sync)
func SyncPagesFromMinIO(ctx context.Context, key string, updatesHub *Hub) error {
	objectKey := parseObjectKey(key)
	debug.Log("SyncPagesFromMinIO begin for bucket: %s, key: %s", bucketNamePages, objectKey)

	// Extract slug from path (e.g., "index/page.yml" -> "index")
	parts := strings.Split(objectKey, "/")
	if len(parts) < 2 {
		return fmt.Errorf("invalid page path: %s", objectKey)
	}
	slug := parts[0]

	// Fetch and parse page.yml
	yamlKey := fmt.Sprintf("%s/page.yml", slug)
	yamlObj, err := retrieveAndValidateObject(ctx, bucketNamePages, yamlKey)
	if err != nil {
		return fmt.Errorf("failed to retrieve page.yml: %w", err)
	}
	defer yamlObj.Close()

	yamlBuf, err := readObjectContent(yamlObj)
	if err != nil {
		return fmt.Errorf("failed to read page.yml: %w", err)
	}

	// Validate YAML size (max 10KB)
	if yamlBuf.Len() > 10*1024 {
		return fmt.Errorf("page.yml exceeds maximum size of 10KB")
	}

	// Parse YAML metadata
	var pageMeta meta.PageMetadata
	if err := yaml.Unmarshal(yamlBuf.Bytes(), &pageMeta); err != nil {
		return fmt.Errorf("invalid page.yml: %w", err)
	}

	// Validate metadata
	if err := validatePageMetadata(pageMeta, slug); err != nil {
		return fmt.Errorf("invalid page metadata: %w", err)
	}

	// Check sidebar page limit (only if this page wants to be in sidebar)
	if pageMeta.IsInSidebar {
		var sidebarCount int64
		config.DB.Model(&models.Page{}).
			Where("is_in_sidebar = ? AND slug != ?", true, slug).
			Count(&sidebarCount)
		if sidebarCount >= 15 {
			return fmt.Errorf("maximum 15 sidebar pages exceeded (current: %d)", sidebarCount)
		}
	}

	// Fetch page.html
	htmlKey := fmt.Sprintf("%s/page.html", slug)
	htmlObj, err := retrieveAndValidateObject(ctx, bucketNamePages, htmlKey)
	if err != nil {
		return fmt.Errorf("failed to retrieve page.html: %w", err)
	}
	defer htmlObj.Close()

	htmlBuf, err := readObjectContent(htmlObj)
	if err != nil {
		return fmt.Errorf("failed to read page.html: %w", err)
	}

	// Validate HTML size (max 1MB)
	if htmlBuf.Len() > 1024*1024 {
		return fmt.Errorf("page.html exceeds maximum size of 1MB")
	}

	// Audit log before overwrite
	var existing models.Page
	if config.DB.Where("slug = ?", slug).First(&existing).Error == nil {
		logPageOverwrite(existing, pageMeta)
	}

	// Update/create page in database
	now := time.Now()
	page := models.Page{
		Slug:         slug,
		Title:        pageMeta.Title,
		MinioKey:     htmlKey,
		IsInSidebar:  pageMeta.IsInSidebar,
		Order:        pageMeta.Order,
		Source:       "minio",
		LastSyncedAt: &now,
	}

	// Upsert page record (sanitized HTML is stored in MinIO, we just reference it)
	result := config.DB.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "slug"}},
		DoUpdates: clause.AssignmentColumns([]string{"title", "minio_key", "is_in_sidebar", "order", "source", "last_synced_at", "updated_at"}),
	}).Create(&page)

	if result.Error != nil {
		return fmt.Errorf("failed to sync page to database: %w", result.Error)
	}

	// Broadcast update to connected clients
	if updatesHub != nil {
		if payload, err := json.Marshal(map[string]interface{}{
			"event":  "page",
			"action": "synced",
			"slug":   slug,
		}); err == nil {
			updatesHub.SendToAll(payload)
		}
	}

	debug.Log("Successfully synced page: %s", slug)
	return nil
}

// validatePageMetadata validates page metadata fields
func validatePageMetadata(meta meta.PageMetadata, slug string) error {
	if meta.Title == "" {
		return fmt.Errorf("title cannot be empty")
	}

	if len(meta.Title) > 200 {
		return fmt.Errorf("title cannot exceed 200 characters")
	}

	if meta.Order < 0 {
		return fmt.Errorf("order must be non-negative")
	}

	// Validate slug format (reuse existing validator)
	if err := ValidatePageSlug(slug); err != nil {
		return fmt.Errorf("invalid slug: %w", err)
	}

	return nil
}

// logPageOverwrite logs page overwrites for audit trail
func logPageOverwrite(existing models.Page, newMeta meta.PageMetadata) {
	debug.Log("AUDIT: Overwriting page '%s' (id=%d) - Old: {title=%s, is_in_sidebar=%v, order=%d, source=%s} -> New: {title=%s, is_in_sidebar=%v, order=%d, source=minio}",
		existing.Slug,
		existing.ID,
		existing.Title,
		existing.IsInSidebar,
		existing.Order,
		existing.Source,
		newMeta.Title,
		newMeta.IsInSidebar,
		newMeta.Order,
	)
}
