package models

import "time"

// DualEngine represents a DualEngine.
type DualEngine struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenantId" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt time.Time `json:"updatedAt" db:"updated_at"`
}

// CreateDualEngineRequest is the request body for creating a DualEngine.
type CreateDualEngineRequest struct {
	Name string `json:"name" binding:"required"`
}

// UpdateDualEngineRequest is the request body for updating a DualEngine.
type UpdateDualEngineRequest struct {
	Name *string `json:"name"`
}
