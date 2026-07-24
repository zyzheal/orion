package models

import "time"

// Session is the core domain model persisted in PostgreSQL.
type Session struct {
	ID           string    `db:"id" json:"id"`
	UserID       string    `db:"user_id" json:"user_id"`
	Token        string    `db:"token" json:"token"`
	DeviceInfo   string    `db:"device_info" json:"device_info"`
	IP           string    `db:"ip" json:"ip"`
	LastActiveAt time.Time `db:"last_active_at" json:"last_active_at"`
	ExpiresAt    time.Time `db:"expires_at" json:"expires_at"`
	TenantID     string    `db:"tenant_id" json:"tenant_id"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time `db:"updated_at" json:"updated_at"`
}

// CreateSessionRequest is the input for creating a new session.
type CreateSessionRequest struct {
	UserID     string `json:"user_id" binding:"required"`
	Token      string `json:"token" binding:"required"`
	DeviceInfo string `json:"device_info"`
	IP         string `json:"ip"`
}

// LogoutSessionRequest is the input for logging out a specific session.
type LogoutSessionRequest struct {
	Reason string `json:"reason"`
}

// VerifySessionRequest is the input for verifying a session token.
type VerifySessionRequest struct {
	Token string `json:"token" binding:"required"`
}

// VerifySessionResponse is the output of session verification.
type VerifySessionResponse struct {
	Valid      bool      `json:"valid"`
	SessionID  string    `json:"session_id"`
	UserID     string    `json:"user_id"`
	DeviceInfo string    `json:"device_info"`
	IP         string    `json:"ip"`
	ExpiresAt  time.Time `json:"expires_at"`
}
