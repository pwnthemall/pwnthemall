package utils

import (
	"errors"
	"net/url"
	"strings"
)

// NormalizeSocialURL normalizes and validates social media URLs
// Accepts either full URLs or just usernames/handles
func NormalizeSocialURL(platform, input string) (string, error) {
	input = strings.TrimSpace(input)

	if input == "" {
		return "", nil
	}

	// Length limit
	if len(input) > 200 {
		return "", errors.New("URL too long (max 200 characters)")
	}

	// If already a full URL, validate it
	if strings.HasPrefix(input, "https://") || strings.HasPrefix(input, "http://") {
		return ValidateFullURL(platform, input)
	}

	// Otherwise treat as handle and construct URL
	switch platform {
	case "github":
		// Remove @ prefix if present
		handle := strings.TrimPrefix(input, "@")
		return "https://github.com/" + handle, nil
	case "X":
		handle := strings.TrimPrefix(input, "@")
		return "https://x.com/" + handle, nil
	case "linkedin":
		// Accept linkedin.com/in/username format
		if strings.HasPrefix(input, "linkedin.com/in/") {
			return "https://" + input, nil
		}
		return "https://linkedin.com/in/" + input, nil
	case "discord":
		// Discord usernames can contain special characters, store as-is
		return input, nil
	case "website":
		// Website must be full URL
		return "", errors.New("website must be a full URL starting with https://")
	default:
		return "", errors.New("unsupported platform")
	}
}

// ValidateFullURL validates a full social media URL
func ValidateFullURL(platform, fullURL string) (string, error) {
	// Parse URL
	parsedURL, err := url.Parse(fullURL)
	if err != nil {
		return "", errors.New("invalid URL format")
	}

	// Must be HTTPS (except for local development)
	if parsedURL.Scheme != "https" && parsedURL.Scheme != "http" {
		return "", errors.New("only HTTP/HTTPS URLs allowed")
	}

	// Normalize to HTTPS for public-facing URLs
	normalizedURL := strings.Replace(fullURL, "http://", "https://", 1)

	// Platform-specific domain validation
	switch platform {
	case "github":
		if !strings.Contains(normalizedURL, "github.com/") {
			return "", errors.New("must be a github.com URL")
		}
	case "X":
		if !strings.Contains(normalizedURL, "x.com/") && !strings.Contains(normalizedURL, "twitter.com/") {
			return "", errors.New("must be a x.com or twitter.com URL")
		}
		// Normalize twitter.com to x.com for consistency
		normalizedURL = strings.Replace(normalizedURL, "twitter.com/", "x.com/", 1)
	case "linkedin":
		if !strings.Contains(normalizedURL, "linkedin.com/") {
			return "", errors.New("must be a linkedin.com URL")
		}
	case "website":
		// Any HTTPS URL is acceptable for website
		if parsedURL.Scheme != "https" && parsedURL.Scheme != "http" {
			return "", errors.New("website must use HTTPS")
		}
	case "discord":
		// Discord doesn't use URLs, validation should have caught this
		return "", errors.New("discord should be username, not URL")
	}

	return normalizedURL, nil
}
