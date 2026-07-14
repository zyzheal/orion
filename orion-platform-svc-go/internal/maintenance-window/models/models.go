package models

import "time"

// MaintenanceWindow represents a MaintenanceWindow.
type MaintenanceWindow struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenantId" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt time.Time `json:"updatedAt" db:"updated_at"`
}

// CreateMaintenanceWindowRequest is the request body for creating a MaintenanceWindow.
type CreateMaintenanceWindowRequest struct {
	Name string `json:"name" binding:"required"`
}

// UpdateMaintenanceWindowRequest is the request body for updating a MaintenanceWindow.
type UpdateMaintenanceWindowRequest struct {
	Name *string `json:"name"`
}
