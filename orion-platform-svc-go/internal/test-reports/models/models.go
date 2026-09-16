package models

import "time"

type TestReportsItem struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenant_id" db:"tenant_id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	Enabled     bool      `json:"enabled" db:"enabled"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type CreateTestReportsRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Enabled     bool   `json:"enabled"`
}
