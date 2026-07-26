package models

import "time"

// ArtifactRegistry represents a container for storing artifacts.
type ArtifactRegistry struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenant_id" db:"tenant_id"`
	Name        string    `json:"name" db:"name"`
	Type        string    `json:"type" db:"type"` // docker, npm, maven, generic
	BaseURL     string    `json:"base_url" db:"base_url"`
	Description string    `json:"description" db:"description"`
	Config      string    `json:"config" db:"config"`
	IsEnabled   bool      `json:"is_enabled" db:"is_enabled"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// ArtifactEntry represents a single artifact in the registry.
type ArtifactEntry struct {
	ID            string    `json:"id" db:"id"`
	RegistryID    string    `json:"registry_id" db:"registry_id"`
	Name          string    `json:"name" db:"name"`
	Version       string    `json:"version" db:"version"`
	ContentType   string    `json:"content_type" db:"content_type"`
	Size          int64     `json:"size" db:"size"`
	Checksum      string    `json:"checksum" db:"checksum"`
	StoragePath   string    `json:"storage_path" db:"storage_path"`
	Metadata      string    `json:"metadata" db:"metadata"`
	IsLatest      bool      `json:"is_latest" db:"is_latest"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
}

// CreateRegistryRequest for creating a registry.
type CreateRegistryRequest struct {
	Name        string `json:"name" binding:"required"`
	Type        string `json:"type" binding:"required,oneof=docker npm maven generic"`
	BaseURL     string `json:"base_url"`
	Description string `json:"description"`
	Config      string `json:"config"`
}

// PushArtifactRequest for pushing an artifact.
type PushArtifactRequest struct {
	RegistryID  string                 `json:"registry_id" binding:"required"`
	Name        string                 `json:"name" binding:"required"`
	Version     string                 `json:"version" binding:"required"`
	ContentType string                 `json:"content_type"`
	Size        int64                  `json:"size"`
	Checksum    string                 `json:"checksum"`
	StoragePath string                 `json:"storage_path"`
	Metadata    map[string]interface{} `json:"metadata"`
}

// RegistryResponse wraps registry query results.
type RegistryResponse struct {
	Total int64              `json:"total"`
	Data  []ArtifactRegistry `json:"data"`
}

// ArtifactResponse wraps artifact query results.
type ArtifactResponse struct {
	Total int64          `json:"total"`
	Data  []ArtifactEntry `json:"data"`
}
