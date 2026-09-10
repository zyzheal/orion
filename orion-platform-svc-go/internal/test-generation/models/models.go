package models

import "time"

// StatusActive is the default status assigned to new records.
const StatusActive = "pending"

type Record struct {
	ID        string                 `json:"id" db:"id"`
	TenantID  string                 `json:"tenantId" db:"tenant_id"`
	Name      string                 `json:"name" db:"name"`
	Status    string                 `json:"status" db:"status"`
	Metadata  map[string]interface{} `json:"metadata" db:"-"`
	CreatedAt time.Time              `json:"createdAt" db:"created_at"`
	UpdatedAt time.Time              `json:"updatedAt" db:"updated_at"`
	DeletedAt *time.Time             `json:"-" db:"deleted_at"`
}

type ListQuery struct {
	Page   int    `json:"page" query:"page"`
	Limit  int    `json:"limit" query:"limit"`
	Status string `json:"status" query:"status"`
}

type CreateRequest struct {
	Name   string                 `json:"name" binding:"required"`
	Status string                 `json:"status"`
	Config map[string]interface{} `json:"config"`
}
