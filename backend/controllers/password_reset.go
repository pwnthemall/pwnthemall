package controllers

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pwnthemall/pwnthemall/backend/config"
	"github.com/pwnthemall/pwnthemall/backend/dto"
	"github.com/pwnthemall/pwnthemall/backend/models"
	"github.com/pwnthemall/pwnthemall/backend/utils"
	"golang.org/x/crypto/bcrypt"
)

func ForgotPassword(c *gin.Context) {
	var resetConfig models.Config
	if err := config.DB.Where("key = ?", "PASSWORD_RESET_ENABLED").First(&resetConfig).Error; err == nil {
		if resetConfig.Value == "false" || resetConfig.Value == "0" {
			utils.ForbiddenError(c, "Password reset is currently disabled")
			return
		}
	}

	var input dto.ForgotPasswordInput
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.BadRequestError(c, "Invalid email address")
		return
	}

	email := strings.ToLower(strings.TrimSpace(input.Email))

	var user models.User
	userErr := config.DB.Where("email = ?", email).First(&user).Error

	// Only send email if user exists, but always return success (prevent enumeration)
	if userErr == nil {
		tokenBytes := make([]byte, 32)
		if _, err := rand.Read(tokenBytes); err != nil {
			utils.InternalServerError(c, "Failed to generate reset token")
			return
		}

		rawToken := base64.URLEncoding.EncodeToString(tokenBytes)

		hasher := sha256.New()
		hasher.Write([]byte(rawToken))
		hashedToken := fmt.Sprintf("%x", hasher.Sum(nil))

		clientIP := c.ClientIP()

		resetToken := models.PasswordResetToken{
			UserID:    user.ID,
			Token:     hashedToken,
			ExpiresAt: time.Now().Add(30 * time.Minute), // 30 minutes expiration (security best practice)
			IPAddress: clientIP,
		}

		config.DB.Where("user_id = ? AND used_at IS NULL", user.ID).Delete(&models.PasswordResetToken{})

		if err := config.DB.Create(&resetToken).Error; err != nil {
			utils.InternalServerError(c, "Failed to create reset token")
			return
		}

		lang := "en"
		acceptLang := c.GetHeader("Accept-Language")
		if strings.Contains(strings.ToLower(acceptLang), "fr") {
			lang = "fr"
		}

		// Send password reset email asynchronously to avoid blocking
		go func() {
			if err := utils.SendPasswordResetEmail(email, user.Username, rawToken, lang); err != nil {
				// Log error but don't expose to client
				fmt.Printf("Failed to send password reset email to %s: %v\n", email, err)
			}
		}()
	}

	// Constant-time response to prevent enumeration
	time.Sleep(100 * time.Millisecond)

	utils.OKResponse(c, gin.H{
		"message": "If an account exists with this email, you will receive password reset instructions shortly.",
	})
}

func ResetPassword(c *gin.Context) {
	var resetConfig models.Config
	if err := config.DB.Where("key = ?", "PASSWORD_RESET_ENABLED").First(&resetConfig).Error; err == nil {
		if resetConfig.Value == "false" || resetConfig.Value == "0" {
			utils.ForbiddenError(c, "Password reset is currently disabled")
			return
		}
	}

	var input dto.ResetPasswordInput
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.BadRequestError(c, "Invalid input. Password must be 8-72 characters")
		return
	}

	// Hash the provided token to match database
	hasher := sha256.New()
	hasher.Write([]byte(input.Token))
	hashedToken := fmt.Sprintf("%x", hasher.Sum(nil))

	// Find the reset token
	var resetToken models.PasswordResetToken
	if err := config.DB.Where("token = ?", hashedToken).First(&resetToken).Error; err != nil {
		utils.BadRequestError(c, "Unable to process password reset request")
		return
	}

	if !resetToken.IsValid() {
		utils.BadRequestError(c, "Unable to process password reset request")
		return
	}

	var user models.User
	if err := config.DB.First(&user, resetToken.UserID).Error; err != nil {
		utils.NotFoundError(c, "User not found")
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		utils.InternalServerError(c, "Failed to hash new password")
		return
	}

	user.Password = string(hashedPassword)
	if err := config.DB.Save(&user).Error; err != nil {
		utils.InternalServerError(c, "Failed to update password")
		return
	}

	now := time.Now()
	resetToken.UsedAt = &now
	if err := config.DB.Save(&resetToken).Error; err != nil {
		// Log error but password is already changed
		fmt.Printf("Failed to mark reset token as used: %v\n", err)
	}

	lang := "en"
	acceptLang := c.GetHeader("Accept-Language")
	if strings.Contains(strings.ToLower(acceptLang), "fr") {
		lang = "fr"
	}

	go func() {
		changeIP := c.ClientIP()
		if err := utils.SendPasswordChangedEmail(user.Email, user.Username, changeIP, lang); err != nil {
			fmt.Printf("Failed to send password changed notification to %s: %v\n", user.Email, err)
		}
	}()

	utils.OKResponse(c, gin.H{
		"message": "Password has been reset successfully. You can now log in with your new password.",
	})
}

func ValidateResetToken(c *gin.Context) {
	var input dto.ValidateResetTokenInput
	if err := c.ShouldBindUri(&input); err != nil {
		utils.BadRequestError(c, "Invalid token")
		return
	}

	// Hash the provided token to match database
	hasher := sha256.New()
	hasher.Write([]byte(input.Token))
	hashedToken := fmt.Sprintf("%x", hasher.Sum(nil))

	// Find the reset token
	var resetToken models.PasswordResetToken
	if err := config.DB.Where("token = ?", hashedToken).First(&resetToken).Error; err != nil {
		utils.BadRequestError(c, "Unable to validate reset token")
		return
	}

	if !resetToken.IsValid() {
		utils.BadRequestError(c, "Unable to validate reset token")
		return
	}

	utils.OKResponse(c, gin.H{
		"valid":      true,
		"expires_at": resetToken.ExpiresAt.Format(time.RFC3339),
	})
}

func SendTestEmail(c *gin.Context) {
	var input dto.SendTestEmailInput
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.BadRequestError(c, "Invalid email address")
		return
	}

	if err := utils.SendTestEmail(input.Email); err != nil {
		utils.InternalServerError(c, fmt.Sprintf("Failed to send test email: %v", err))
		return
	}

	utils.OKResponse(c, gin.H{
		"message": fmt.Sprintf("Test email sent successfully to %s", input.Email),
	})
}
