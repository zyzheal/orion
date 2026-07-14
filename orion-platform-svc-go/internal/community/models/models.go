package models

import "time"

// Community represents a community record.
type Community struct {
	ID        string    `db:"id" json:"id"`
	TenantID  string    `db:"tenant_id" json:"tenantId"`
	Name      string    `db:"name" json:"name"`
	CreatedAt time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt time.Time `db:"updated_at" json:"updatedAt"`
}

// CreateRequest is the request body for creating a community entry.
type CreateRequest struct {
	Name string `json:"name" binding:"required"`
}

// UpdateRequest is the request body for updating a community entry.
type UpdateRequest struct {
	Name *string `json:"name"`
}

// PaginatedResponse is a generic paginated response.
type PaginatedResponse struct {
	Data     interface{} `json:"data"`
	Total    int         `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
}
