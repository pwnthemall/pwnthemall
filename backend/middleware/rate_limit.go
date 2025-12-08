package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type rateLimiter struct {
	attempts  map[string][]time.Time
	mu        sync.RWMutex
	maxTries  int
	window    time.Duration
}

var joinTeamLimiter = &rateLimiter{
	attempts: make(map[string][]time.Time),
	maxTries: 5,
	window:   1 * time.Minute,
}

var loginLimiter = &rateLimiter{
	attempts: make(map[string][]time.Time),
	maxTries: 5,
	window:   1 * time.Minute,
}

func RateLimitLogin() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Use IP address as key for login attempts
		key := c.ClientIP()
		now := time.Now()

		loginLimiter.mu.Lock()
		defer loginLimiter.mu.Unlock()

		attempts := loginLimiter.attempts[key]
		var validAttempts []time.Time
		for _, attemptTime := range attempts {
			if now.Sub(attemptTime) < loginLimiter.window {
				validAttempts = append(validAttempts, attemptTime)
			}
		}

		if len(validAttempts) >= loginLimiter.maxTries {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "too_many_login_attempts"})
			c.Abort()
			return
		}

		validAttempts = append(validAttempts, now)
		loginLimiter.attempts[key] = validAttempts

		c.Next()
	}
}

func RateLimitJoinTeam() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("user_id")
		if !exists {
			c.Next()
			return
		}

		key := string(rune(userID.(uint)))
		now := time.Now()

		joinTeamLimiter.mu.Lock()
		defer joinTeamLimiter.mu.Unlock()

		attempts := joinTeamLimiter.attempts[key]
		var validAttempts []time.Time
		for _, attemptTime := range attempts {
			if now.Sub(attemptTime) < joinTeamLimiter.window {
				validAttempts = append(validAttempts, attemptTime)
			}
		}

		if len(validAttempts) >= joinTeamLimiter.maxTries {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "too_many_attempts"})
			c.Abort()
			return
		}

		validAttempts = append(validAttempts, now)
		joinTeamLimiter.attempts[key] = validAttempts

		c.Next()
	}
}
