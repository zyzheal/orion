package models

import "time"

// Record is the core artifact-version entity.
type Record struct {
	ID        string                 `json:"id" db:"id"`
	TenantID  string                 `json:"tenantId" db:"tenant_id"`
	Name      string                 `json:"name" db:"name"`
	Status    string                 `json:"status" db:"status"`
	Metadata  map[string]interface{} `json:"metadata,omitempty" db:"metadata"`
	CreatedAt time.Time              `json:"createdAt" db:"created_at"`
	UpdatedAt time.Time              `json:"updatedAt" db:"updated_at"`
	DeletedAt *time.Time             `json:"deletedAt,omitempty" db:"deleted_at"`
}

// Tag is an immutable label attached to a Record.
type Tag struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenantId" db:"tenant_id"`
	RecordID  string    `json:"recordId" db:"record_id"`
	Tag       string    `json:"tag" db:"tag"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
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

type AddTagRequest struct {
	Tag string `json:"tag" binding:"required"`
}

const StatusActive = "active"
