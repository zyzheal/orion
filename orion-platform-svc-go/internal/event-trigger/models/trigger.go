package models

import "time"

// ---------------------------------------------------------------------------
// EventTrigger
// ---------------------------------------------------------------------------

// EventTrigger defines a trigger that responds to a specific event type.
type EventTrigger struct {
	ID          string    `db:"id" json:"id"`
	Name        string    `db:"name" json:"name"`
	EventType   string    `db:"event_type" json:"event_type"` // e.g. "pipeline.completed"
	Action      string    `db:"action" json:"action"`         // webhook | pipeline | notification
	Target      string    `db:"target" json:"target"`         // target URL or pipeline ID
	Enabled     bool      `db:"enabled" json:"enabled"`
	Description string    `db:"description" json:"description"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	UserID      string    `db:"user_id" json:"user_id"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

// ---------------------------------------------------------------------------
// Request / Filter types
// ---------------------------------------------------------------------------

// CreateTriggerRequest is the request payload for creating a trigger.
type CreateTriggerRequest struct {
	Name        string `json:"name" binding:"required"`
	EventType   string `json:"event_type" binding:"required"`
	Action      string `json:"action" binding:"required"`
	Target      string `json:"target" binding:"required"`
	Enabled     *bool  `json:"enabled"`
	Description string `json:"description"`
}

// UpdateTriggerRequest is the request payload for updating a trigger.
type UpdateTriggerRequest struct {
	Name        string `json:"name"`
	EventType   string `json:"event_type"`
	Action      string `json:"action"`
	Target      string `json:"target"`
	Enabled     *bool  `json:"enabled"`
	Description string `json:"description"`
}

// ListFilter holds optional filters for listing triggers.
type ListFilter struct {
	EventType *string
	Enabled   *bool
}
