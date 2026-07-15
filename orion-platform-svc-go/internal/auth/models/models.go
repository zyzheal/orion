package models

import "time"

// LoginRequest for user login.
type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// LoginResponse returned on successful login.
type LoginResponse struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	ExpiresAt    int64  `json:"expiresAt"`
	TenantID     string `json:"tenantId,omitempty"`
	User         UserInfo `json:"user"`
}

// RegisterRequest for user registration.
type RegisterRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
	Email    string `json:"email,omitempty"`
}

// RegisterResponse returned on successful registration.
type RegisterResponse struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email,omitempty"`
	Role     string `json:"role"`
	Message  string `json:"message"`
}

// RefreshRequest for token refresh.
type RefreshRequest struct {
	RefreshToken string `json:"refreshToken" binding:"required"`
}

// RefreshResponse returned on successful token refresh.
type RefreshResponse struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	ExpiresAt    int64  `json:"expiresAt"`
	TenantID     string `json:"tenantId,omitempty"`
}

// LogoutRequest for user logout.
type LogoutRequest struct {
	RefreshToken string `json:"refreshToken"`
	AccessToken  string `json:"accessToken"`
}

// MeResponse for the /me endpoint.
type MeResponse struct {
	ID              string   `json:"id"`
	Username        string   `json:"username"`
	Email           string   `json:"email"`
	FullName        string   `json:"full_name,omitempty"`
	Role            string   `json:"role"`
	Status          string   `json:"status"`
	Avatar          string   `json:"avatar"`
	Tenants         []string `json:"tenants"`
	CurrentTenantID string   `json:"currentTenantId,omitempty"`
}

// UserInfo is a safe (no password) user representation.
type UserInfo struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Role     string `json:"role"`
	Avatar   string `json:"avatar"`
}

// RefreshToken is the database model for refresh_tokens table.
type RefreshToken struct {
	ID        string    `json:"id" db:"id"`
	UserID    string    `json:"user_id" db:"user_id"`
	TokenHash string    `json:"token_hash" db:"token_hash"`
	ExpiresAt time.Time `json:"expires_at" db:"expires_at"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}
