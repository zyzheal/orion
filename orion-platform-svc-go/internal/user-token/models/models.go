package models

import "time"

// Token represents an API token for a user.
type Token struct {
	ID         string     `json:"id" db:"id"`
	UserID     string     `json:"userId" db:"user_id"`
	Name       string     `json:"name" db:"name"`
	TokenHash  string     `json:"tokenHash" db:"token_hash"`
	ExpiresAt  *time.Time `json:"expiresAt,omitempty" db:"expires_at"`
	LastUsedAt *time.Time `json:"lastUsedAt,omitempty" db:"last_used_at"`
	CreatedAt  time.Time  `json:"createdAt" db:"created_at"`
}

// CreateTokenRequest is the request to create a new token.
type CreateTokenRequest struct {
	UserID        string `json:"userId" binding:"required"`
	Name          string `json:"name" binding:"required"`
	ExpiresInDays *int   `json:"expiresInDays,omitempty"`
}

// CreateTokenResponse is the response after creating a token.
type CreateTokenResponse struct {
	Token string `json:"token"` // Raw token (only returned once)
}
