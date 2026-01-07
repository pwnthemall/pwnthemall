package dto

// ForgotPasswordInput represents the input for requesting a password reset
type ForgotPasswordInput struct {
	Email string `json:"email" binding:"required,email,max=254"`
}

// ResetPasswordInput represents the input for resetting a password with a token
type ResetPasswordInput struct {
	Token    string `json:"token" binding:"required"`
	Password string `json:"password" binding:"required,min=8,max=72"`
}

// ValidateResetTokenInput represents the input for validating a reset token
type ValidateResetTokenInput struct {
	Token string `uri:"token" binding:"required"`
}

// SendTestEmailInput represents the input for sending a test email (admin only)
type SendTestEmailInput struct {
	Email string `json:"email" binding:"required,email,max=254"`
}
