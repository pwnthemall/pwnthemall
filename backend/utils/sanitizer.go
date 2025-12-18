package utils

import (
	"regexp"

	"github.com/microcosm-cc/bluemonday"
)

var (
	// StrictPolicy strips all HTML tags - use for sensitive fields
	StrictPolicy *bluemonday.Policy
	// UGCPolicy allows safe HTML for user-generated content
	UGCPolicy *bluemonday.Policy
	// FilenameRegex validates filenames to prevent path traversal
	FilenameRegex *regexp.Regexp
)

func init() {
	// StrictPolicy removes all HTML - for ticket subjects, usernames, etc.
	StrictPolicy = bluemonday.StrictPolicy()

	// UGCPolicy allows safe formatting for descriptions/messages
	// Allows basic formatting: bold, italic, links, lists, but strips scripts/iframes
	UGCPolicy = bluemonday.UGCPolicy()

	// Only allow alphanumeric, underscore, hyphen, and dot in filenames
	FilenameRegex = regexp.MustCompile(`^[a-zA-Z0-9_\-\.]+$`)
}

// SanitizeStrict removes all HTML tags and returns plain text
func SanitizeStrict(input string) string {
	return StrictPolicy.Sanitize(input)
}

// SanitizeUGC sanitizes user-generated content, allowing safe HTML
func SanitizeUGC(input string) string {
	return UGCPolicy.Sanitize(input)
}

// IsValidFilename checks if a filename is safe (no path traversal attempts)
func IsValidFilename(filename string) bool {
	if filename == "" || len(filename) > 255 {
		return false
	}
	// Reject filenames with path separators or parent directory references
	if regexp.MustCompile(`[/\\]|\.\.`).MatchString(filename) {
		return false
	}
	// Must match whitelist pattern
	return FilenameRegex.MatchString(filename)
}
