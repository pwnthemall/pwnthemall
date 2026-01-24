package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

var (
	globalLimiters   = make(map[int]*rateLimiter)
	globalLimitersMu sync.RWMutex
)

type rateLimiter struct {
	attempts map[string][]time.Time
	mu       sync.RWMutex
	maxTries int
	window   time.Duration
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

func RateLimit(maxRequests int) gin.HandlerFunc {
	globalLimitersMu.Lock()
	limiter, exists := globalLimiters[maxRequests]
	if !exists {
		limiter = &rateLimiter{
			attempts: make(map[string][]time.Time),
			maxTries: maxRequests,
			window:   1 * time.Minute,
		}
		globalLimiters[maxRequests] = limiter

		// Start cleanup goroutine for this limiter
		go func(l *rateLimiter) {
			ticker := time.NewTicker(5 * time.Minute)
			defer ticker.Stop()

			for range ticker.C {
				l.mu.Lock()
				now := time.Now()
				for key, attempts := range l.attempts {
					var validAttempts []time.Time
					for _, attemptTime := range attempts {
						if now.Sub(attemptTime) < l.window {
							validAttempts = append(validAttempts, attemptTime)
						}
					}
					if len(validAttempts) == 0 {
						delete(l.attempts, key)
					} else {
						l.attempts[key] = validAttempts
					}
				}
				l.mu.Unlock()
			}
		}(limiter)
	}
	globalLimitersMu.Unlock()

	return func(c *gin.Context) {
		key := c.ClientIP()
		now := time.Now()

		limiter.mu.Lock()
		defer limiter.mu.Unlock()

		attempts := limiter.attempts[key]
		var validAttempts []time.Time
		for _, attemptTime := range attempts {
			if now.Sub(attemptTime) < limiter.window {
				validAttempts = append(validAttempts, attemptTime)
			}
		}

		if len(validAttempts) >= limiter.maxTries {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":   "rate_limit_exceeded",
				"message": "Too many requests. Please try again later.",
			})
			c.Abort()
			return
		}

		validAttempts = append(validAttempts, now)
		limiter.attempts[key] = validAttempts

		c.Next()
	}
}
