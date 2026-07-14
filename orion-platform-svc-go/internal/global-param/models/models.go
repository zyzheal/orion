package models

import "time"

// GlobalParam represents a GlobalParam.
type GlobalParam struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenantId" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt time.Time `json:"updatedAt" db:"updated_at"`
}

// CreateGlobalParamRequest is the request body for creating a GlobalParam.
type CreateGlobalParamRequest struct {
	Name string `json:"name" binding:"required"`
}

// UpdateGlobalParamRequest is the request body for updating a GlobalParam.
type UpdateGlobalParamRequest struct {
	Name *string `json:"name"`
}
