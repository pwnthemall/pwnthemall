package utils

import (
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/pwnthemall/pwnthemall/backend/config"
	"github.com/pwnthemall/pwnthemall/backend/debug"
	"github.com/pwnthemall/pwnthemall/backend/models"
)

var (
	AccessSecret  = []byte(os.Getenv("JWT_SECRET"))
	RefreshSecret = []byte(os.Getenv("REFRESH_SECRET"))
	// TokenBlacklist stores invalidated tokens in memory with DB persistence
	TokenBlacklist = &sync.Map{}
)

type TokenClaims struct {
	UserID uint   `json:"user_id"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

func GenerateAccessToken(userID uint, role string) (string, error) {
	claims := TokenClaims{
		UserID: userID,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(45 * time.Minute)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(AccessSecret)
}

func GenerateRefreshToken(userID uint) (string, error) {
	claims := jwt.RegisteredClaims{
		Subject:   strconv.Itoa(int(userID)),
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(RefreshSecret)
}

func GetClaimsFromCookie(c *gin.Context) (*TokenClaims, error) {
	tokenStr, err := c.Cookie("access_token")
	if err != nil {
		return nil, err
	}

	// Check if token is blacklisted (in-memory cache first)
	if _, blacklisted := TokenBlacklist.Load(tokenStr); blacklisted {
		return nil, jwt.ErrTokenInvalidClaims
	}

	// Check database for blacklisted tokens (persistent storage)
	var blacklistedToken models.BlacklistedToken
	if err := config.DB.Where("token = ? AND expires_at > ?", tokenStr, time.Now()).First(&blacklistedToken).Error; err == nil {
		// Token found in blacklist, cache it in memory
		TokenBlacklist.Store(tokenStr, true)
		return nil, jwt.ErrTokenInvalidClaims
	}

	token, err := jwt.ParseWithClaims(tokenStr, &TokenClaims{}, func(token *jwt.Token) (interface{}, error) {
		return AccessSecret, nil
	})
	if err != nil || !token.Valid {
		return nil, err
	}

	return token.Claims.(*TokenClaims), nil
}

// BlacklistToken adds a token to the blacklist with TTL based on expiration
func BlacklistToken(tokenStr string, expiresAt time.Time) {
	TokenBlacklist.Store(tokenStr, true)

	// db persistence
	blacklistedToken := models.BlacklistedToken{
		Token:     tokenStr,
		ExpiresAt: expiresAt,
	}
	if err := config.DB.Create(&blacklistedToken).Error; err != nil {
		debug.Log("Error blacklisting token in DB: %v", err)
	}

	go func() {
		ttl := time.Until(expiresAt)
		if ttl > 0 {
			time.Sleep(ttl)
		}
		TokenBlacklist.Delete(tokenStr)
	}()
}

func LoadBlacklistedTokensFromDB() error {
	var blacklistedTokens []models.BlacklistedToken
	if err := config.DB.Where("expires_at > ?", time.Now()).Find(&blacklistedTokens).Error; err != nil {
		return err
	}

	for _, bt := range blacklistedTokens {
		TokenBlacklist.Store(bt.Token, true)

		// Schedule cleanup
		go func(token string, expiresAt time.Time) {
			ttl := time.Until(expiresAt)
			if ttl > 0 {
				time.Sleep(ttl)
			}
			TokenBlacklist.Delete(token)
		}(bt.Token, bt.ExpiresAt)
	}

	return nil
}

// called by main.go scheduler
func CleanupExpiredBlacklistedTokens() error {
	return config.DB.Where("expires_at <= ?", time.Now()).Delete(&models.BlacklistedToken{}).Error
}
