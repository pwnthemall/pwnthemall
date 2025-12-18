package utils

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
)

func HashFlag(flag string) string {
	hash := sha256.Sum256([]byte(flag))
	return hex.EncodeToString(hash[:])
}

func GenerateRandomString(n int) (string, error) {
	bytes := make([]byte, n)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}