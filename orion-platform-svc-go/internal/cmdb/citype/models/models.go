package models

import "time"

// CIType defines a Configuration Item type with its attribute schema.
type CIType struct {
	ID          string            `json:"id" db:"id"`
	TenantID    string            `json:"tenantId" db:"tenant_id"`
	Name        string            `json:"name" db:"name"`
	Description *string           `json:"description" db:"description"`
	Category    string            `json:"category" db:"category"`
	Icon        *string           `json:"icon" db:"icon"`
	Version     int               `json:"version" db:"version"`
	Enabled     bool              `json:"enabled" db:"enabled"`
	Attributes  map[string]any    `json:"attributes" db:"attributes"`
	CreatedAt   time.Time         `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time         `json:"updatedAt" db:"updated_at"`
}

type CreateCITypeRequest struct {
	Name        string         `json:"name" binding:"required"`
	Description *string        `json:"description"`
	Category    string         `json:"category"`
	Icon        *string        `json:"icon"`
	Attributes  map[string]any `json:"attributes"`
	TenantID    *string        `json:"tenantId"`
}

type UpdateCITypeRequest struct {
	Name        *string        `json:"name"`
	Description *string        `json:"description"`
	Category    *string        `json:"category"`
	Icon        *string        `json:"icon"`
	Attributes  map[string]any `json:"attributes"`
	Enabled     *bool          `json:"enabled"`
}
