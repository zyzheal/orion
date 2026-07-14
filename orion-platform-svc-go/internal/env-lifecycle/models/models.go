package models

import "time"

// EnvLifecycle represents a EnvLifecycle.
type EnvLifecycle struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenantId" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt time.Time `json:"updatedAt" db:"updated_at"`
}

// CreateEnvLifecycleRequest is the request body for creating a EnvLifecycle.
type CreateEnvLifecycleRequest struct {
	Name string `json:"name" binding:"required"`
}

// UpdateEnvLifecycleRequest is the request body for updating a EnvLifecycle.
type UpdateEnvLifecycleRequest struct {
	Name *string `json:"name"`
}
