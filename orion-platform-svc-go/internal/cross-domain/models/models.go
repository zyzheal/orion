package models

import "time"

// CrossDomain represents a CrossDomain.
type CrossDomain struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenantId" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt time.Time `json:"updatedAt" db:"updated_at"`
}

// CreateCrossDomainRequest is the request body for creating a CrossDomain.
type CreateCrossDomainRequest struct {
	Name string `json:"name" binding:"required"`
}

// UpdateCrossDomainRequest is the request body for updating a CrossDomain.
type UpdateCrossDomainRequest struct {
	Name *string `json:"name"`
}
