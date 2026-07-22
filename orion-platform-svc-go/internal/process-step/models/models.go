package models

import "time"

// ProcessStep represents a process-step record.
type ProcessStep struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	Value     string    `json:"value" db:"value"`
	Enabled   bool      `json:"enabled" db:"enabled"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type CreateProcessStepRequest struct {
	Name    string `json:"name" binding:"required"`
	Value   string `json:"value"`
	Enabled bool   `json:"enabled"`
}

type UpdateProcessStepRequest struct {
	Name    *string `json:"name"`
	Value   *string `json:"value"`
	Enabled *bool   `json:"enabled"`
}
