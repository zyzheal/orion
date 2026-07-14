package models

import "time"

// Analysis represents a canary analysis record.
type Analysis struct {
	ID        string    `db:"id" json:"id"`
	TenantID  string    `db:"tenant_id" json:"tenantId"`
	Name      string    `db:"name" json:"name"`
	Status    string    `db:"status" json:"status"`
	Metadata  string    `db:"metadata" json:"metadata"`
	CreatedAt time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt time.Time `db:"updated_at" json:"updatedAt"`
}

// CreateRequest is the request body for creating an analysis.
type CreateRequest struct {
	Name     string `json:"name" binding:"required"`
	Status   string `json:"status"`
	Metadata string `json:"metadata"`
}

// UpdateRequest is the request body for updating an analysis.
type UpdateRequest struct {
	Name     *string `json:"name"`
	Status   *string `json:"status"`
	Metadata *string `json:"metadata"`
}

// PaginatedResponse is a generic paginated response.
type PaginatedResponse struct {
	Data     interface{} `json:"data"`
	Total    int         `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
}
