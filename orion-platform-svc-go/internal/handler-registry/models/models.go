package models

import "time"

// HandlerRegistry - Legacy CRUD model (retained for backward compatibility)
type HandlerRegistry struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type CreateHandlerRegistryRequest struct {
	Name string `json:"name" binding:"required"`
}

type UpdateHandlerRegistryRequest struct {
	Name *string `json:"name"`
}

// HandlerRegistryEntry - Handler SPI registry entry (metadata + config)
type HandlerRegistryEntry struct {
	ID           string                 `json:"id" db:"id"`
	TenantID     string                 `json:"tenant_id" db:"tenant_id"`
	Domain       string                 `json:"domain" db:"domain"`
	Name         string                 `json:"name" db:"name"`
	DisplayName  string                 `json:"display_name" db:"display_name"`
	Description  string                 `json:"description" db:"description"`
	Status       string                 `json:"status" db:"status"` // active, disabled
	Config       map[string]interface{} `json:"config" db:"config"`
	RegisteredBy string                 `json:"registered_by" db:"registered_by"`
	CreatedAt    time.Time              `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time              `json:"updated_at" db:"updated_at"`
}

// RegisterHandlerRequest - Request to register a new handler
type RegisterHandlerRequest struct {
	Domain       string                 `json:"domain" binding:"required"`
	Name         string                 `json:"name" binding:"required"`
	DisplayName  string                 `json:"display_name,omitempty"`
	Description  string                 `json:"description,omitempty"`
	Config       map[string]interface{} `json:"config,omitempty"`
	RegisteredBy string                 `json:"registered_by,omitempty"`
}

// InvokeHandlerRequest - Request to invoke a handler
type InvokeHandlerRequest struct {
	Payload map[string]interface{} `json:"payload,omitempty"`
}

// EnableHandlerRequest - Request to enable a handler
type EnableHandlerRequest struct{}

// DisableHandlerRequest - Request to disable a handler
type DisableHandlerRequest struct{}

// ListHandlerRegistryOptions - Options for listing handlers
type ListHandlerRegistryOptions struct {
	Domain string `json:"domain,omitempty"`
	Status string `json:"status,omitempty"`
}
