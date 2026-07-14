package models

import "time"

// Hook defines a hook that runs at a specific pipeline stage or event point.
type Hook struct {
	ID          string    `db:"id" json:"id"`
	Name        string    `db:"name" json:"name"`
	Description string    `db:"description" json:"description"`
	Trigger     string    `db:"trigger" json:"trigger"` // pre-build, post-deploy, etc.
	Action      string    `db:"action" json:"action"`    // script, webhooks, etc.
	Config      string    `db:"config" json:"config"`    // JSON config
	Enabled     bool      `db:"enabled" json:"enabled"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	UserID      string    `db:"user_id" json:"user_id"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

// CreateHookRequest is the input for creating a new hook.
type CreateHookRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Trigger     string `json:"trigger" binding:"required"`
	Action      string `json:"action" binding:"required"`
	Config      string `json:"config"`
	Enabled     *bool  `json:"enabled"`
}

// UpdateHookRequest is the input for updating a hook.
type UpdateHookRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Trigger     string `json:"trigger"`
	Action      string `json:"action"`
	Config      string `json:"config"`
	Enabled     *bool  `json:"enabled"`
}

// ListFilter carries optional filter criteria for listing hooks.
type ListFilter struct {
	Trigger *string
	Enabled *bool
}
