package utils

import (
	"archive/zip"
	"bytes"
	"context"
	"fmt"
	"io"
	"strings"

	"github.com/minio/minio-go/v7"
	"github.com/pwnthemall/pwnthemall/backend/config"
	"github.com/pwnthemall/pwnthemall/backend/debug"
	"github.com/pwnthemall/pwnthemall/backend/models"
)

// GenerateChallengeYAML creates YAML content for challenge export (flags redacted)
func GenerateChallengeYAML(challenge models.Challenge) string {
	yaml := fmt.Sprintf("name: %s\n", challenge.Name)
	yaml += fmt.Sprintf("description: |\n  %s\n", strings.ReplaceAll(challenge.Description, "\n", "\n  "))

	if challenge.ChallengeCategory != nil {
		yaml += fmt.Sprintf("category: %s\n", challenge.ChallengeCategory.Name)
	}
	if challenge.ChallengeDifficulty != nil {
		yaml += fmt.Sprintf("difficulty: %s\n", challenge.ChallengeDifficulty.Name)
	}
	if challenge.ChallengeType != nil {
		yaml += fmt.Sprintf("type: %s\n", challenge.ChallengeType.Name)
	}
	if challenge.DecayFormula != nil {
		yaml += fmt.Sprintf("decay: \"%s\"\n", challenge.DecayFormula.Name)
	}

	yaml += fmt.Sprintf("author: %s\n", challenge.Author)
	yaml += "flags: [\"REDACTED\"]\n" // Don't include actual flags
	yaml += fmt.Sprintf("hidden: %t\n", challenge.Hidden)
	yaml += fmt.Sprintf("points: %d\n", challenge.Points)

	if challenge.MaxAttempts > 0 {
		yaml += fmt.Sprintf("attempts: %d\n", challenge.MaxAttempts)
	}

	if len(challenge.Ports) > 0 {
		yaml += "ports: ["
		for i, port := range challenge.Ports {
			if i > 0 {
				yaml += ", "
			}
			yaml += fmt.Sprintf("%d", port)
		}
		yaml += "]\n"
	}

	if challenge.CoverImg != "" {
		yaml += fmt.Sprintf("cover_img: %s\n", challenge.CoverImg)
	}

	if len(challenge.ConnectionInfo) > 0 {
		yaml += "connection_info: ["
		for i, info := range challenge.ConnectionInfo {
			if i > 0 {
				yaml += ", "
			}
			yaml += fmt.Sprintf("\"%s\"", info)
		}
		yaml += "]\n"
	}

	return yaml
}

// CopyZipFilesToWriter extracts files from source ZIP and copies them to destination ZIP writer
func CopyZipFilesToWriter(zipData []byte, destWriter *zip.Writer) (int, error) {
	zipReader, err := zip.NewReader(bytes.NewReader(zipData), int64(len(zipData)))
	if err != nil {
		return 0, fmt.Errorf("failed to open ZIP: %w", err)
	}

	filesAdded := 0
	for _, f := range zipReader.File {
		// Skip chall.yml (we create our own)
		if f.Name == "chall.yml" {
			continue
		}

		rc, err := f.Open()
		if err != nil {
			debug.Log("Failed to open file %s from ZIP: %v", f.Name, err)
			continue
		}

		w, err := destWriter.Create(f.Name)
		if err != nil {
			rc.Close()
			debug.Log("Failed to create file %s in export ZIP: %v", f.Name, err)
			continue
		}

		if _, err := io.Copy(w, rc); err != nil {
			debug.Log("Failed to copy file %s to export ZIP: %v", f.Name, err)
		}
		rc.Close()
		filesAdded++
	}

	return filesAdded, nil
}

// GetChallengeZipFromMinIO retrieves challenge ZIP from MinIO bucket
func GetChallengeZipFromMinIO(bucket, challengeSlug string) ([]byte, error) {
	zipPath := fmt.Sprintf("challenges/%s.zip", challengeSlug)
	zipObj, err := config.FS.GetObject(context.Background(), bucket, zipPath, minio.GetObjectOptions{})
	if err != nil {
		return nil, fmt.Errorf("ZIP not found at %s: %w", zipPath, err)
	}
	defer zipObj.Close()

	zipData, err := io.ReadAll(zipObj)
	if err != nil {
		return nil, fmt.Errorf("failed to read ZIP: %w", err)
	}

	return zipData, nil
}

// shouldSkipFile determines if a file should be excluded from export
func shouldSkipFile(fileName string) bool {
	// Skip chall.yml (we create our own)
	if fileName == "chall.yml" {
		return true
	}

	// Skip resized cover images (only include original)
	if strings.Contains(fileName, "_resized.webp") {
		return true
	}

	return false
}

// CopyIndividualFilesFromMinIO copies files from old storage system to ZIP
func CopyIndividualFilesFromMinIO(bucket, challengeSlug string, filesList []string, destWriter *zip.Writer) int {
	filesAdded := 0

	// First, copy files listed in challenge.Files
	for _, fileName := range filesList {
		objectPath := fmt.Sprintf("%s/%s", challengeSlug, fileName)
		obj, err := config.FS.GetObject(context.Background(), bucket, objectPath, minio.GetObjectOptions{})
		if err != nil {
			debug.Log("File %s not found in old system: %v", fileName, err)
			continue
		}

		fileWriter, err := destWriter.Create(fileName)
		if err != nil {
			obj.Close()
			debug.Log("Failed to create file %s in ZIP: %v", fileName, err)
			continue
		}

		if _, err := io.Copy(fileWriter, obj); err != nil {
			debug.Log("Failed to copy file %s to ZIP: %v", fileName, err)
		}
		obj.Close()
		filesAdded++
	}

	// List and copy all other files in the challenge directory
	objectCh := config.FS.ListObjects(context.Background(), bucket, minio.ListObjectsOptions{
		Prefix:    challengeSlug + "/",
		Recursive: true,
	})

	addedFiles := make(map[string]bool)
	for _, f := range filesList {
		addedFiles[f] = true
	}

	for object := range objectCh {
		if object.Err != nil {
			debug.Log("Error listing objects: %v", object.Err)
			continue
		}

		// Get relative filename (remove slug prefix)
		fileName := strings.TrimPrefix(object.Key, challengeSlug+"/")
		if fileName == "" {
			continue
		}

		// Skip files that should be excluded
		if shouldSkipFile(fileName) {
			continue
		}

		// Skip if already added
		if addedFiles[fileName] {
			continue
		}

		obj, err := config.FS.GetObject(context.Background(), bucket, object.Key, minio.GetObjectOptions{})
		if err != nil {
			debug.Log("Failed to get object %s: %v", object.Key, err)
			continue
		}

		fileWriter, err := destWriter.Create(fileName)
		if err != nil {
			obj.Close()
			debug.Log("Failed to create file %s in ZIP: %v", fileName, err)
			continue
		}

		if _, err := io.Copy(fileWriter, obj); err != nil {
			debug.Log("Failed to copy file %s to ZIP: %v", fileName, err)
		}
		obj.Close()
		filesAdded++
		addedFiles[fileName] = true
	}

	return filesAdded
}
