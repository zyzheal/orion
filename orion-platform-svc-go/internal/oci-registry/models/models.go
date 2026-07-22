package models

import "time"

// OciRegistry represents a oci-registry record.
type OciRegistry struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	Value     string    `json:"value" db:"value"`
	Enabled   bool      `json:"enabled" db:"enabled"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type CreateOciRegistryRequest struct {
	Name    string `json:"name" binding:"required"`
	Value   string `json:"value"`
	Enabled bool   `json:"enabled"`
}

type UpdateOciRegistryRequest struct {
	Name    *string `json:"name"`
	Value   *string `json:"value"`
	Enabled *bool   `json:"enabled"`
}

// ToggleRegistryRequest is the request body for enabling/disabling a registry.
type ToggleRegistryRequest struct {
	Enabled bool `json:"enabled"`
}

// TagsQuery is the query parameters for listing image tags.
type TagsQuery struct {
	Page  int `json:"page" form:"page"`
	Limit int `json:"limit" form:"limit"`
}

// Tag represents a single image tag in an OCI repository.
type Tag struct {
	Name      string `json:"name"`
	Digest    string `json:"digest"`
	Size      int64  `json:"size"`
	CreatedAt int64  `json:"createdAt"`
}

// TagsResponse is the response for listing image tags.
type TagsResponse struct {
	Total int   `json:"total"`
	Tags  []Tag `json:"tags"`
}
