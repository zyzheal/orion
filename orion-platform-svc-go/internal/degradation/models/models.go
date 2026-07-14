package models

import "time"

// Degradation represents a Degradation.
type Degradation struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenantId" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt time.Time `json:"updatedAt" db:"updated_at"`
}

// CreateDegradationRequest is the request body for creating a Degradation.
type CreateDegradationRequest struct {
	Name string `json:"name" binding:"required"`
}

// UpdateDegradationRequest is the request body for updating a Degradation.
type UpdateDegradationRequest struct {
	Name *string `json:"name"`
}
