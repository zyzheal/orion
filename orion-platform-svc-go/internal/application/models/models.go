package models

import "time"

// Application is the core domain model persisted in PostgreSQL.
type Application struct {
	ID        string    `db:"id" json:"id"`
	Name      string    `db:"name" json:"name"`
	TenantID  string    `db:"tenant_id" json:"tenant_id"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

// CreateApplicationRequest is the input for creating a new application.
type CreateApplicationRequest struct {
	Name string `json:"name" binding:"required"`
}

// ListFilter carries optional filter criteria for listing applications.
type ListFilter struct {
	Name *string
}
