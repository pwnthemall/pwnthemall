package utils

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/pwnthemall/pwnthemall/backend/config"
	"github.com/pwnthemall/pwnthemall/backend/models"
)

var (
	// Regex patterns for slug sanitization
	nonAlphanumericRegex = regexp.MustCompile(`[^a-z0-9\s-]`)
	multipleHyphensRegex = regexp.MustCompile(`-+`)
	multipleSpacesRegex  = regexp.MustCompile(`\s+`)
)

// GenerateSlug creates a URL-safe slug from a string
// - Converts to lowercase
// - Removes special characters (keeps alphanumeric, spaces, hyphens)
// - Replaces spaces with hyphens
// - Collapses multiple hyphens into one
// - Trims leading/trailing hyphens
func GenerateSlug(name string) string {
	if name == "" {
		return ""
	}

	// Lowercase
	slug := strings.ToLower(name)

	// Remove any path traversal attempts
	slug = strings.ReplaceAll(slug, "../", "")
	slug = strings.ReplaceAll(slug, "./", "")
	slug = strings.ReplaceAll(slug, "\\", "")

	// Remove special characters (keep alphanumeric, spaces, hyphens)
	slug = nonAlphanumericRegex.ReplaceAllString(slug, "")

	// Collapse multiple spaces into one
	slug = multipleSpacesRegex.ReplaceAllString(slug, " ")

	// Trim spaces
	slug = strings.TrimSpace(slug)

	// Replace spaces with hyphens
	slug = strings.ReplaceAll(slug, " ", "-")

	// Collapse multiple hyphens into one
	slug = multipleHyphensRegex.ReplaceAllString(slug, "-")

	// Trim leading/trailing hyphens
	slug = strings.Trim(slug, "-")

	// Limit length to 100 characters
	if len(slug) > 100 {
		slug = slug[:100]
		// Ensure we don't cut in the middle of a hyphen sequence
		slug = strings.Trim(slug, "-")
	}

	return slug
}

// GenerateUniqueSlug creates a unique slug by checking the database
// If the base slug already exists, appends -2, -3, etc.
func GenerateUniqueSlug(name string) (string, error) {
	baseSlug := GenerateSlug(name)
	if baseSlug == "" {
		return "", fmt.Errorf("invalid name: cannot generate slug")
	}

	// Check if base slug exists
	var count int64
	if err := config.DB.Model(&models.Challenge{}).Where("slug = ?", baseSlug).Count(&count).Error; err != nil {
		return "", fmt.Errorf("failed to check slug uniqueness: %w", err)
	}

	if count == 0 {
		return baseSlug, nil
	}

	// Find a unique slug by appending numbers
	for i := 2; i <= 1000; i++ {
		candidateSlug := fmt.Sprintf("%s-%d", baseSlug, i)
		if err := config.DB.Model(&models.Challenge{}).Where("slug = ?", candidateSlug).Count(&count).Error; err != nil {
			return "", fmt.Errorf("failed to check slug uniqueness: %w", err)
		}
		if count == 0 {
			return candidateSlug, nil
		}
	}

	return "", fmt.Errorf("failed to generate unique slug: too many duplicates")
}

// IsValidSlug checks if a slug is valid (no path traversal, proper format)
func IsValidSlug(slug string) bool {
	if slug == "" {
		return false
	}

	// Check for path traversal attempts
	if strings.Contains(slug, "..") || strings.Contains(slug, "./") || strings.Contains(slug, "\\") {
		return false
	}

	// Check format: only lowercase alphanumeric and hyphens
	validSlugRegex := regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)
	return validSlugRegex.MatchString(slug)
}
