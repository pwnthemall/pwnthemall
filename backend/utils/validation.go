package utils

import (
	"regexp"
	"unicode"
)

// ValidateUsername checks for malicious Unicode characters and enforces alphanumeric rules
// Returns error key if invalid, empty string if valid
func ValidateUsername(username string) string {
	// Check length
	if len(username) == 0 {
		return "username_required"
	}
	if len(username) > 32 {
		return "username_too_long"
	}

	// Allow only alphanumeric characters, underscore, and hyphen
	validPattern := regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)
	if !validPattern.MatchString(username) {
		return "username_invalid_characters"
	}

	// Additional check: reject any Unicode control characters or non-printable chars
	for _, r := range username {
		// Check for dangerous Unicode categories
		if unicode.Is(unicode.Cc, r) || // Control characters
			unicode.Is(unicode.Cf, r) || // Format characters (includes RTL override)
			unicode.Is(unicode.Co, r) || // Private use
			unicode.Is(unicode.Cs, r) || // Surrogates
			unicode.Is(unicode.Zl, r) || // Line separator
			unicode.Is(unicode.Zp, r) { // Paragraph separator
			return "username_invalid_characters"
		}

		// Reject zero-width characters
		if r == '\u200B' || // Zero-width space
			r == '\u200C' || // Zero-width non-joiner
			r == '\u200D' || // Zero-width joiner
			r == '\uFEFF' { // Zero-width no-break space
			return "username_invalid_characters"
		}
	}

	return ""
}
