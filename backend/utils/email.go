package utils

import (
	"bytes"
	"crypto/tls"
	"errors"
	"fmt"
	"html/template"
	"net/smtp"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/pwnthemall/pwnthemall/backend/config"
	"github.com/pwnthemall/pwnthemall/backend/models"
)

// EmailConfig holds SMTP configuration
type EmailConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	From     string
}

// GetEmailConfig retrieves and decrypts SMTP configuration
func GetEmailConfig() (*EmailConfig, error) {
	var smtpHost, smtpPort, smtpUser, smtpPassword, smtpFrom models.Config

	dbErr := false
	if err := config.DB.Where("key = ?", "SMTP_HOST").First(&smtpHost).Error; err != nil {
		dbErr = true
	}
	if err := config.DB.Where("key = ?", "SMTP_PORT").First(&smtpPort).Error; err != nil {
		dbErr = true
	}
	if err := config.DB.Where("key = ?", "SMTP_USER").First(&smtpUser).Error; err != nil {
		dbErr = true
	}
	if err := config.DB.Where("key = ?", "SMTP_PASSWORD").First(&smtpPassword).Error; err != nil {
		dbErr = true
	}
	if err := config.DB.Where("key = ?", "SMTP_FROM").First(&smtpFrom).Error; err != nil {
		dbErr = true
	}

	if dbErr {
		portStr := os.Getenv("SMTP_PORT")
		if portStr == "" {
			portStr = "587"
		}
		port, err := strconv.Atoi(portStr)
		if err != nil {
			port = 587
		}

		smtpFrom := os.Getenv("SMTP_FROM")
		if smtpFrom == "" {
			smtpFrom = os.Getenv("SMTP_USER")
		}

		return &EmailConfig{
			Host:     os.Getenv("SMTP_HOST"),
			Port:     port,
			User:     os.Getenv("SMTP_USER"),
			Password: os.Getenv("SMTP_PASSWORD"),
			From:     smtpFrom,
		}, nil
	}

	password := smtpPassword.Value
	if smtpPassword.Encrypted {
		key, err := GetEncryptionKey()
		if err != nil {
			return nil, fmt.Errorf("failed to get encryption key: %w", err)
		}
		decrypted, err := DecryptString(password, key)
		if err != nil {
			return nil, fmt.Errorf("failed to decrypt SMTP password: %w", err)
		}
		password = decrypted
	}

	port, err := strconv.Atoi(smtpPort.Value)
	if err != nil {
		port = 587
	}

	return &EmailConfig{
		Host:     smtpHost.Value,
		Port:     port,
		User:     smtpUser.Value,
		Password: password,
		From:     smtpFrom.Value,
	}, nil
}

// EmailTemplate represents an email with subject and body
type EmailTemplate struct {
	Subject  string
	HTMLBody string
	TextBody string
}

func SendEmail(to, subject, htmlBody, textBody string) error {
	cfg, err := GetEmailConfig()
	if err != nil {
		return fmt.Errorf("failed to get email config: %w", err)
	}

	if cfg.Host == "" || cfg.User == "" || cfg.Password == "" {
		return errors.New("SMTP configuration is incomplete")
	}

	// Build message
	from := cfg.From
	if from == "" {
		from = cfg.User
	}

	// Create multipart message
	boundary := "boundary-" + fmt.Sprintf("%d", time.Now().Unix())
	message := fmt.Sprintf("From: %s\r\n", from)
	message += fmt.Sprintf("To: %s\r\n", to)
	message += fmt.Sprintf("Subject: %s\r\n", subject)
	message += "MIME-Version: 1.0\r\n"
	message += fmt.Sprintf("Content-Type: multipart/alternative; boundary=\"%s\"\r\n", boundary)
	message += "\r\n"

	// Add plain text part
	if textBody != "" {
		message += fmt.Sprintf("--%s\r\n", boundary)
		message += "Content-Type: text/plain; charset=\"UTF-8\"\r\n"
		message += "\r\n"
		message += textBody + "\r\n"
		message += "\r\n"
	}

	// Add HTML part
	if htmlBody != "" {
		message += fmt.Sprintf("--%s\r\n", boundary)
		message += "Content-Type: text/html; charset=\"UTF-8\"\r\n"
		message += "\r\n"
		message += htmlBody + "\r\n"
		message += "\r\n"
	}

	message += fmt.Sprintf("--%s--\r\n", boundary)

	// Set up authentication
	auth := smtp.PlainAuth("", cfg.User, cfg.Password, cfg.Host)

	// Connect to the server
	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)

	// For ports 465 (implicit TLS) vs 587 (STARTTLS)
	var client *smtp.Client
	if cfg.Port == 465 {
		// Direct TLS connection
		tlsConfig := &tls.Config{
			ServerName: cfg.Host,
		}
		conn, err := tls.Dial("tcp", addr, tlsConfig)
		if err != nil {
			return fmt.Errorf("failed to connect to SMTP server: %w", err)
		}
		defer conn.Close()

		client, err = smtp.NewClient(conn, cfg.Host)
		if err != nil {
			return fmt.Errorf("failed to create SMTP client: %w", err)
		}
	} else {
		// STARTTLS connection (port 587, 25, etc.)
		var err error
		client, err = smtp.Dial(addr)
		if err != nil {
			return fmt.Errorf("failed to connect to SMTP server: %w", err)
		}

		// STARTTLS if available
		if ok, _ := client.Extension("STARTTLS"); ok {
			tlsConfig := &tls.Config{
				ServerName: cfg.Host,
			}
			if err = client.StartTLS(tlsConfig); err != nil {
				return fmt.Errorf("failed to start TLS: %w", err)
			}
		}
	}
	defer client.Close()

	// Authenticate
	if err = client.Auth(auth); err != nil {
		return fmt.Errorf("SMTP authentication failed: %w", err)
	}

	// Set sender and recipient
	if err = client.Mail(from); err != nil {
		return fmt.Errorf("failed to set sender: %w", err)
	}

	if err = client.Rcpt(to); err != nil {
		return fmt.Errorf("failed to set recipient: %w", err)
	}

	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("failed to get data writer: %w", err)
	}

	_, err = w.Write([]byte(message))
	if err != nil {
		return fmt.Errorf("failed to write email body: %w", err)
	}

	err = w.Close()
	if err != nil {
		return fmt.Errorf("failed to close data writer: %w", err)
	}

	return client.Quit()
}

func GetSiteName() string {
	var siteNameConfig models.Config
	if err := config.DB.Where("key = ?", "SITE_NAME").First(&siteNameConfig).Error; err == nil && siteNameConfig.Value != "" {
		return siteNameConfig.Value
	}
	// Fallback to environment variable or default
	return config.GetEnvWithDefault("PTA_SITE_NAME", "PwnThemAll")
}

// PasswordResetEmailData holds data for password reset email template
type PasswordResetEmailData struct {
	Username  string
	ResetLink string
	ExpiresIn string
	SiteName  string
	Year      int
}

// PasswordChangedEmailData holds data for password changed notification
type PasswordChangedEmailData struct {
	Username string
	SiteName string
	Year     int
	ChangeIP string
}

func SendPasswordResetEmail(email, username, token, lang string) error {
	siteName := GetSiteName()

	// Build reset link
	publicDomain := os.Getenv("PTA_PUBLIC_DOMAIN")
	if publicDomain == "" {
		publicDomain = "localhost"
	}
	protocol := "https"
	if strings.Contains(publicDomain, "localhost") || strings.Contains(publicDomain, "127.0.0.1") {
		protocol = "http"
	}
	resetLink := fmt.Sprintf("%s://%s/reset-password/%s", protocol, publicDomain, token)

	// Prepare template data
	data := PasswordResetEmailData{
		Username:  username,
		ResetLink: resetLink,
		ExpiresIn: "30 minutes",
		SiteName:  siteName,
		Year:      time.Now().Year(),
	}

	// Load templates based on language
	templateDir := "backend/templates"
	if _, err := os.Stat(templateDir); os.IsNotExist(err) {
		templateDir = "templates" // Try relative path
	}

	htmlFile := fmt.Sprintf("%s/password_reset_%s.html", templateDir, lang)
	textFile := fmt.Sprintf("%s/password_reset_%s.txt", templateDir, lang)

	// Fallback to English if language not found
	if _, err := os.Stat(htmlFile); os.IsNotExist(err) {
		htmlFile = fmt.Sprintf("%s/password_reset_en.html", templateDir)
		textFile = fmt.Sprintf("%s/password_reset_en.txt", templateDir)
	}

	// Parse HTML template
	htmlTmpl, err := template.ParseFiles(htmlFile)
	if err != nil {
		return fmt.Errorf("failed to parse HTML template: %w", err)
	}

	var htmlBuf bytes.Buffer
	if err := htmlTmpl.Execute(&htmlBuf, data); err != nil {
		return fmt.Errorf("failed to execute HTML template: %w", err)
	}

	// Parse text template
	textTmpl, err := template.ParseFiles(textFile)
	if err != nil {
		return fmt.Errorf("failed to parse text template: %w", err)
	}

	var textBuf bytes.Buffer
	if err := textTmpl.Execute(&textBuf, data); err != nil {
		return fmt.Errorf("failed to execute text template: %w", err)
	}

	// Set subject based on language
	subject := fmt.Sprintf("[%s] Password Reset Request", siteName)
	if lang == "fr" {
		subject = fmt.Sprintf("[%s] Demande de réinitialisation de mot de passe", siteName)
	}

	return SendEmail(email, subject, htmlBuf.String(), textBuf.String())
}

func SendPasswordChangedEmail(email, username, changeIP, lang string) error {
	siteName := GetSiteName()

	data := PasswordChangedEmailData{
		Username: username,
		SiteName: siteName,
		Year:     time.Now().Year(),
		ChangeIP: changeIP,
	}

	// Load templates based on language
	templateDir := "backend/templates"
	if _, err := os.Stat(templateDir); os.IsNotExist(err) {
		templateDir = "templates"
	}

	htmlFile := fmt.Sprintf("%s/password_changed_%s.html", templateDir, lang)
	textFile := fmt.Sprintf("%s/password_changed_%s.txt", templateDir, lang)

	// Fallback to English if language not found
	if _, err := os.Stat(htmlFile); os.IsNotExist(err) {
		htmlFile = fmt.Sprintf("%s/password_changed_en.html", templateDir)
		textFile = fmt.Sprintf("%s/password_changed_en.txt", templateDir)
	}

	// Parse HTML template
	htmlTmpl, err := template.ParseFiles(htmlFile)
	if err != nil {
		return fmt.Errorf("failed to parse HTML template: %w", err)
	}

	var htmlBuf bytes.Buffer
	if err := htmlTmpl.Execute(&htmlBuf, data); err != nil {
		return fmt.Errorf("failed to execute HTML template: %w", err)
	}

	// Parse text template
	textTmpl, err := template.ParseFiles(textFile)
	if err != nil {
		return fmt.Errorf("failed to parse text template: %w", err)
	}

	var textBuf bytes.Buffer
	if err := textTmpl.Execute(&textBuf, data); err != nil {
		return fmt.Errorf("failed to execute text template: %w", err)
	}

	// Set subject based on language
	subject := fmt.Sprintf("[%s] Password Changed", siteName)
	if lang == "fr" {
		subject = fmt.Sprintf("[%s] Mot de passe modifié", siteName)
	}

	return SendEmail(email, subject, htmlBuf.String(), textBuf.String())
}

func SendTestEmail(to string) error {
	siteName := GetSiteName()

	subject := fmt.Sprintf("[%s] SMTP Test Email", siteName)
	htmlBody := fmt.Sprintf(`
		<html>
		<body>
			<h2>SMTP Configuration Test</h2>
			<p>This is a test email from %s.</p>
			<p>If you received this email, your SMTP configuration is working correctly.</p>
			<p><small>Sent at: %s</small></p>
		</body>
		</html>
	`, siteName, time.Now().Format(time.RFC1123))

	textBody := fmt.Sprintf(`
SMTP Configuration Test

This is a test email from %s.

If you received this email, your SMTP configuration is working correctly.

Sent at: %s
	`, siteName, time.Now().Format(time.RFC1123))

	return SendEmail(to, subject, htmlBody, textBody)
}
