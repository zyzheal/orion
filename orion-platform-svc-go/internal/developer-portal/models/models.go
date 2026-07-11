package models

import "time"

type DeveloperPortal struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type CreateDeveloperPortalRequest struct {
	Name string `json:"name" binding:"required"`
}

type UpdateDeveloperPortalRequest struct {
	Name *string `json:"name"`
}
