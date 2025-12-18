package utils

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/pwnthemall/pwnthemall/backend/config"
	"github.com/pwnthemall/pwnthemall/backend/models"
)

// Reserved route slugs that cannot be used for custom pages
var reservedSlugs = []string{
	"api", "admin", "ping", "ws", "login", "register", "logout", "me",
	"teams", "users", "challenges", "configs", "instances", "notifications",
	"submissions", "dashboard", "badges", "pwn", "scoreboard", "profile",
	"live", "cookies", "mobile-blocked", "_app", "_document", "404",
	"_next", "public", "static", "favicon.ico", "robots.txt", "sitemap.xml",
}

// Regex for valid slug format: lowercase alphanumeric and hyphens only
var validSlugRegex = regexp.MustCompile(`^[a-z0-9-]+$`)

// ValidatePageSlug validates a page slug for security and format requirements
// Returns error if slug is invalid
func ValidatePageSlug(slug string) error {
	// Trim whitespace
	slug = strings.TrimSpace(slug)

	// Check length (1-100 characters)
	if len(slug) < 1 {
		return fmt.Errorf("slug cannot be empty")
	}
	if len(slug) > 100 {
		return fmt.Errorf("slug cannot exceed 100 characters")
	}

	// Check for path traversal attempts
	if strings.Contains(slug, "..") || strings.Contains(slug, "./") || strings.Contains(slug, "\\") {
		return fmt.Errorf("slug contains invalid path traversal characters")
	}

	// Check against reserved slugs
	if IsReservedSlug(slug) {
		return fmt.Errorf("slug '%s' is reserved and cannot be used", slug)
	}

	// Check format (alphanumeric and hyphens only)
	if !validSlugRegex.MatchString(slug) {
		return fmt.Errorf("slug must contain only lowercase letters, numbers, and hyphens")
	}

	// Check for leading/trailing hyphens
	if strings.HasPrefix(slug, "-") || strings.HasSuffix(slug, "-") {
		return fmt.Errorf("slug cannot start or end with a hyphen")
	}

	// Check for consecutive hyphens
	if strings.Contains(slug, "--") {
		return fmt.Errorf("slug cannot contain consecutive hyphens")
	}

	return nil
}

// IsReservedSlug checks if a slug is in the reserved list
func IsReservedSlug(slug string) bool {
	slugLower := strings.ToLower(strings.TrimSpace(slug))
	for _, reserved := range reservedSlugs {
		if slugLower == reserved {
			return true
		}
	}
	return false
}

// IsSlugUnique checks if a slug is unique in the database
// Optionally exclude a specific page ID (for updates)
func IsSlugUnique(slug string, excludeID uint) (bool, error) {
	var count int64
	query := config.DB.Model(&models.Page{}).Where("slug = ?", slug)

	if excludeID > 0 {
		query = query.Where("id != ?", excludeID)
	}

	if err := query.Count(&count).Error; err != nil {
		return false, err
	}

	return count == 0, nil
}
