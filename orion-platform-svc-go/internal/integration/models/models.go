package models

import "time"

// Integration represents a Integration.
type Integration struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenantId" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt time.Time `json:"updatedAt" db:"updated_at"`
}

// CreateIntegrationRequest is the request body for creating a Integration.
type CreateIntegrationRequest struct {
	Name string `json:"name" binding:"required"`
}

// UpdateIntegrationRequest is the request body for updating a Integration.
type UpdateIntegrationRequest struct {
	Name *string `json:"name"`
}
