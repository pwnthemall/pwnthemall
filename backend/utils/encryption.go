package utils

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"io"
	"os"
)

var (
	// ErrInvalidCiphertext indicates that the ciphertext is invalid or corrupted
	ErrInvalidCiphertext = errors.New("invalid ciphertext")
	// ErrEmptyKey indicates that the encryption key is empty
	ErrEmptyKey = errors.New("encryption key cannot be empty")
)

// EncryptString encrypts a plaintext string using AES-256-GCM
// Returns base64-encoded ciphertext
func EncryptString(plaintext string, key []byte) (string, error) {
	if len(key) == 0 {
		return "", ErrEmptyKey
	}

	// Ensure key is 32 bytes for AES-256
	if len(key) != 32 {
		return "", errors.New("encryption key must be 32 bytes for AES-256")
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	// Use GCM mode for authenticated encryption
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	// Generate a random nonce
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	// Encrypt and authenticate
	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)

	// Return base64-encoded ciphertext
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// DecryptString decrypts a base64-encoded ciphertext using AES-256-GCM
// Returns the original plaintext string
func DecryptString(ciphertextB64 string, key []byte) (string, error) {
	if len(key) == 0 {
		return "", ErrEmptyKey
	}

	// Ensure key is 32 bytes for AES-256
	if len(key) != 32 {
		return "", errors.New("encryption key must be 32 bytes for AES-256")
	}

	// Decode base64
	ciphertext, err := base64.StdEncoding.DecodeString(ciphertextB64)
	if err != nil {
		return "", ErrInvalidCiphertext
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return "", ErrInvalidCiphertext
	}

	// Extract nonce and ciphertext
	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]

	// Decrypt and verify
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", ErrInvalidCiphertext
	}

	return string(plaintext), nil
}

// GetEncryptionKey retrieves the encryption key from environment
// The key should be 32 bytes for AES-256
func GetEncryptionKey() ([]byte, error) {
	keyEnv := os.Getenv("PTA_ENCRYPTION_KEY")
	if keyEnv == "" {
		return nil, errors.New("PTA_ENCRYPTION_KEY environment variable not set")
	}

	// Convert to bytes - key should be exactly 32 bytes
	key := []byte(keyEnv)
	if len(key) != 32 {
		return nil, errors.New("PTA_ENCRYPTION_KEY must be exactly 32 bytes")
	}

	return key, nil
}
