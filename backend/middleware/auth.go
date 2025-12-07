package middleware

import (
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"strings"

	"github.com/pwnthemall/pwnthemall/backend/config"
	"github.com/pwnthemall/pwnthemall/backend/models"
	"github.com/pwnthemall/pwnthemall/backend/utils"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

// getClientIP extracts the real client IP from the request
func getClientIP(c *gin.Context) string {
	// Check X-Forwarded-For header first (common behind proxies)
	if xff := c.GetHeader("X-Forwarded-For"); xff != "" {
		// Take the first IP in the comma-separated list
		if ips := strings.Split(xff, ","); len(ips) > 0 {
			ip := strings.TrimSpace(ips[0])
			if net.ParseIP(ip) != nil {
				return ip
			}
		}
	}

	// Check X-Real-IP header (common with Nginx)
	if xri := c.GetHeader("X-Real-IP"); xri != "" {
		if net.ParseIP(xri) != nil {
			return xri
		}
	}

	// Fall back to RemoteAddr
	if ip, _, err := net.SplitHostPort(c.Request.RemoteAddr); err == nil {
		if net.ParseIP(ip) != nil {
			return ip
		}
	}

	// Last resort, return the RemoteAddr as-is
	return c.ClientIP()
}

// updateUserIP adds the current IP to the user's IP address list if not already present
func updateUserIP(userID uint, currentIP string) {
	if currentIP == "" || currentIP == "127.0.0.1" || currentIP == "::1" || os.Getenv("PTA_DEMO") == "true" {
		return // Skip localhost IPs
	}

	var user models.User
	if err := config.DB.Select("ip_addresses").First(&user, userID).Error; err != nil {
		return
	}

	// Check if IP already exists in the list
	for _, ip := range user.IPAddresses {
		if ip == currentIP {
			return // IP already tracked
		}
	}

	// Add the new IP (limit to last 10 IPs to prevent unlimited growth)
	user.IPAddresses = append(user.IPAddresses, currentIP)
	if len(user.IPAddresses) > 10 {
		user.IPAddresses = user.IPAddresses[len(user.IPAddresses)-10:]
	}

	// Update only the IP addresses field
	config.DB.Model(&user).Select("ip_addresses").Where("id = ?", userID).Updates(models.User{
		IPAddresses: user.IPAddresses,
	})
}

// AuthRequired ensures a user is logged in
func SessionAuthRequired(needTeam bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		session := sessions.Default(c)
		userID := session.Get("user_id")
		if userID == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		// Vérifie que l'utilisateur existe encore en BDD
		var user models.User
		if err := config.DB.Preload("Team").First(&user, userID).Error; err != nil {
			session.Clear()
			session.Save()
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		if user.Banned {
			session.Clear()
			session.Save()
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "banned"})
			return
		}

		if needTeam {
			if user.TeamID == nil || user.Team == nil {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "team required"})
				return
			}
		}

		// Track user IP address
		go updateUserIP(user.ID, getClientIP(c))

		c.Set("user_id", userID)
		c.Set("user", &user)
		c.Next()
	}
}

func CheckPolicy(obj string, act string) gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, errMsg := utils.GetClaimsFromCookie(c)
		if claims == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": errMsg})
			return
		}

		sub := fmt.Sprint(claims.Role)
		if sub == "" {
			sub = "anonymous"
		}

		// Vérification Casbin
		err := config.CEF.LoadPolicy()

		if err != nil {
			log.Fatalf("Casbin error: %v", err)
			c.AbortWithStatusJSON(500, gin.H{"error": "Internal server error"})
			return

		}
		ok, err := config.CEF.Enforce(sub, obj, act)
		if err != nil {
			log.Printf("Casbin error: %v", err)
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "authorization error"})
			return
		}

		if !ok {
			// log.Printf("Unauthorized action: sub:%s act:%s obj:%s", sub, act, obj)
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "unauthorized: wrong permissions"})
			return
		}

		c.Next()
	}
}

func AuthRequired(needTeam bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, err := utils.GetClaimsFromCookie(c)
		if claims == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": err})
			return
		}
		var user models.User
		if err := config.DB.Preload("Team").First(&user, claims.UserID).Error; err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
			return
		}

		if user.Banned {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "banned"})
			return
		}

		if needTeam && (user.TeamID == nil || user.Team == nil) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "team_required"})
			return
		}

		// Track user IP address
		go updateUserIP(user.ID, getClientIP(c))

		c.Set("user_id", user.ID)
		c.Set("user", &user)
		c.Next()
	}
}

func AuthRequiredTeamOrAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, err := utils.GetClaimsFromCookie(c)
		if claims == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": err})
			return
		}
		var user models.User
		if err := config.DB.Preload("Team").First(&user, claims.UserID).Error; err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
			return
		}

		if user.Banned {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "banned"})
			return
		}

		if user.Role != "admin" && (user.TeamID == nil || user.Team == nil) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "team_required"})
			return
		}

		if !config.IsCTFStarted() && user.Role != "admin" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "ctf_not_started"})
			return
		}
		// Track user IP address
		go updateUserIP(user.ID, getClientIP(c))

		c.Set("user_id", user.ID)
		c.Set("user", &user)
		c.Next()
	}
}
