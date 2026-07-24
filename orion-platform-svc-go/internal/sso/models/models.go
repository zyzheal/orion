package models

import (
	"time"
)

// Model and related types for sso

// SSOProvider represents an SSO identity provider configuration.
type SSOProvider struct {
	ID           string            `db:"id" json:"id"`
	TenantID     string            `db:"tenant_id" json:"tenant_id"`
	Name         string            `db:"name" json:"name" binding:"required"`
	ProviderType string            `db:"provider_type" json:"provider_type" binding:"required"`
	Config       map[string]string `db:"config" json:"config"`
	Status       string            `db:"status" json:"status"`
	CreatedAt    time.Time         `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time         `db:"updated_at" json:"updated_at"`
}

// SSOLoginRequest is the payload for initiating an SSO login.
type SSOLoginRequest struct {
	ProviderID  string `json:"provider_id" binding:"required"`
	RedirectURL string `json:"redirect_url" binding:"required"`
}

// SSOSession tracks an in-flight SSO login session.
type SSOSession struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	ProviderID  string    `db:"provider_id" json:"provider_id"`
	State       string    `db:"state" json:"state"`
	RedirectURL string    `db:"redirect_url" json:"redirect_url"`
	UserID      string    `db:"user_id" json:"user_id"`
	Status      string    `db:"status" json:"status"`
	ExpiresAt   time.Time `db:"expires_at" json:"expires_at"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
}

// ListProvidersQuery holds filters for listing providers.
type ListProvidersQuery struct {
	Status string
	Limit  int
	Offset int
}
