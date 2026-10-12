package models

import "time"

// ConfigFile represents a configuration file template for inspections.
type ConfigFile struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenantId" db:"tenant_id"`
	Name        string    `json:"name" db:"name"`
	Path        string    `json:"path" db:"path"`
	Content     string    `json:"content" db:"content"`
	Version     int       `json:"version" db:"version"`
	Enabled     bool      `json:"enabled" db:"enabled"`
	CreatedAt   time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time `json:"updatedAt" db:"updated_at"`
}

type CreateConfigFileRequest struct {
	Name      string  `json:"name" binding:"required"`
	Path      string  `json:"path" binding:"required"`
	Content   string  `json:"content"`
	Version   int     `json:"version"`
	Enabled   bool    `json:"enabled"`
	TenantID  *string `json:"tenantId"`
}
