package models

import "time"

// Script represents a script record.
type Script struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	Value     string    `json:"value" db:"value"`
	Enabled   bool      `json:"enabled" db:"enabled"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type CreateScriptRequest struct {
	Name    string `json:"name" binding:"required"`
	Value   string `json:"value"`
	Enabled bool   `json:"enabled"`
}

type UpdateScriptRequest struct {
	Name    *string `json:"name"`
	Value   *string `json:"value"`
	Enabled *bool   `json:"enabled"`
}
