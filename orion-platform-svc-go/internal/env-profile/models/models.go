package models

import "time"

// EnvProfile represents a EnvProfile.
type EnvProfile struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenantId" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt time.Time `json:"updatedAt" db:"updated_at"`
}

// CreateEnvProfileRequest is the request body for creating a EnvProfile.
type CreateEnvProfileRequest struct {
	Name string `json:"name" binding:"required"`
}

// UpdateEnvProfileRequest is the request body for updating a EnvProfile.
type UpdateEnvProfileRequest struct {
	Name *string `json:"name"`
}
