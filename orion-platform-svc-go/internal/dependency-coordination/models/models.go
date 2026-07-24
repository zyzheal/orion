package models

import "time"

// DependencyCoordination represents a DependencyCoordination.
type DependencyCoordination struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenantId" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt time.Time `json:"updatedAt" db:"updated_at"`
}

// CreateDependencyCoordinationRequest is the request body for creating a DependencyCoordination.
type CreateDependencyCoordinationRequest struct {
	Name string `json:"name" binding:"required"`
}

// UpdateDependencyCoordinationRequest is the request body for updating a DependencyCoordination.
type UpdateDependencyCoordinationRequest struct {
	Name *string `json:"name"`
}
