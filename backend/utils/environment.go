package utils

import "os"

// getEnvWithDefault returns the environment variable value or a default if not set
func GetEnvWithDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
