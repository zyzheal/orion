package models

import "time"

// Event represents a published event in the event bus.
type Event struct {
	ID         string    `db:"id" json:"id"`
	Type       string    `db:"type" json:"type"`       // e.g. "pipeline.completed"
	Payload    string    `db:"payload" json:"payload"` // JSON string
	Source     string    `db:"source" json:"source"`   // originating service/module
	TenantID   string    `db:"tenant_id" json:"tenantId"`
	UserID     string    `db:"user_id" json:"userId"`
	OccurredAt time.Time `db:"occurred_at" json:"occurredAt"`
	CreatedAt  time.Time `db:"created_at" json:"createdAt"`
}

// PublishRequest is the request body for publishing an event.
type PublishRequest struct {
	Type    string `json:"type" binding:"required"`
	Payload string `json:"payload" binding:"required"` // JSON
	Source  string `json:"source"`
}

// ListFilter specifies filters for listing events.
type ListFilter struct {
	Type *string
}

// PaginatedResponse is a generic paginated response.
type PaginatedResponse struct {
	Data     interface{} `json:"data"`
	Total    int         `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
}
