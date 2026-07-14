package models

import "time"

// APIKey is the core domain model persisted in PostgreSQL.
// KeyHash stores the SHA-256 hash of the actual API key; the plaintext
// key is never persisted (only returned once at creation time).
type APIKey struct {
	ID        string    `db:"id" json:"id"`
	Name      string    `db:"name" json:"name"`
	KeyHash   string    `db:"key_hash" json:"-"` // never exposed to client
	LastUsedAt *time.Time `db:"last_used_at" json:"last_used_at"`
	ExpiresAt  *time.Time `db:"expires_at" json:"expires_at"`
	Scope     string    `db:"scope" json:"scope"`
	TenantID  string    `db:"tenant_id" json:"tenant_id"`
	UserID    string    `db:"user_id" json:"user_id"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

// CreateKeyRequest is the input for creating a new API key.
type CreateKeyRequest struct {
	Name      string `json:"name" binding:"required"`
	Scope     string `json:"scope"`
	ExpiresAt *time.Time `json:"expires_at"`
}

// CreateKeyResponse is the output when a new key is created.
// Includes the plaintext Key once, which is never retrievable again.
type CreateKeyResponse struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Key       string    `json:"key"` // plaintext, returned once only
	Scope     string    `json:"scope"`
	ExpiresAt *time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}

// ListFilter carries optional filter criteria for listing keys.
type ListFilter struct {
	UserID *string
	Status *string // "active", "expired"
}
