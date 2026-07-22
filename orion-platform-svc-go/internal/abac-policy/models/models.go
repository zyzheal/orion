package models

import "time"

// ABACPolicy represents an attribute-based access control policy.
type ABACPolicy struct {
	ID           string            `db:"id" json:"id"`
	TenantID     string            `db:"tenant_id" json:"tenant_id"`
	Name         string            `db:"name" json:"name"`
	Description  string            `db:"description" json:"description"`
	ResourceType string            `db:"resource_type" json:"resource_type"`
	Action       string            `db:"action" json:"action"`
	Effect       string            `db:"effect" json:"effect"` // allow|deny
	Conditions   map[string]string `db:"conditions" json:"conditions"`
	Status       string            `db:"status" json:"status"` // active|inactive
	CreatedAt    time.Time         `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time         `db:"updated_at" json:"updated_at"`
}

// CreateABACPolicyRequest is the request body for creating an ABAC policy.
type CreateABACPolicyRequest struct {
	Name         string            `json:"name" binding:"required"`
	Description  string            `json:"description"`
	ResourceType string            `json:"resourceType" binding:"required"`
	Action       string            `json:"action" binding:"required"`
	Effect       string            `json:"effect" binding:"required"`
	Conditions   map[string]string `json:"conditions"`
}

// UpdateABACPolicyRequest is the request body for updating an ABAC policy.
type UpdateABACPolicyRequest struct {
	Name        *string           `json:"name"`
	Description *string           `json:"description"`
	Status      *string           `json:"status"`
	Conditions  map[string]string `json:"conditions"`
}

// ABACPolicyFilter is used for listing policies.
type ABACPolicyFilter struct {
	ResourceType *string `json:"resourceType"`
	Status       *string `json:"status"`
	Action       *string `json:"action"`
	Limit        int     `json:"limit"`
	Offset       int     `json:"offset"`
}
