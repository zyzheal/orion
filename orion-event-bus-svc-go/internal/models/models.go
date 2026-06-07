package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// JSONB is a type alias for map that implements sql.Scanner and driver.Valuer
// for PostgreSQL JSONB columns.
type JSONB map[string]interface{}

func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

func (j *JSONB) Scan(src interface{}) error {
	if src == nil {
		*j = nil
		return nil
	}
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, j)
	case string:
		return json.Unmarshal([]byte(v), j)
	default:
		return fmt.Errorf("cannot scan %T into JSONB", src)
	}
}

// EventSubscription represents a handler subscribed to a specific event type
// for a tenant. Maps to the event_subscriptions table.
type EventSubscription struct {
	ID        string    `db:"id"         json:"id"`
	TenantID  string    `db:"tenant_id"  json:"tenant_id"`
	EventType string    `db:"event_type" json:"event_type"`
	Handler   string    `db:"handler"    json:"handler"`
	Enabled   bool      `db:"enabled"    json:"enabled"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

// EventLog represents a published event record. Maps to the event_logs table.
type EventLog struct {
	ID        string `db:"id"         json:"id"`
	TenantID  string `db:"tenant_id"  json:"tenant_id"`
	EventType string `db:"event_type" json:"event_type"`
	Payload   JSONB  `db:"payload"    json:"payload"`
	Processed bool   `db:"processed"  json:"processed"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

// CreateSubscriptionRequest is the request body for subscribing to an event type.
type CreateSubscriptionRequest struct {
	EventType string `json:"event_type" binding:"required"`
	Handler   string `json:"handler"    binding:"required"`
}

// PublishEventRequest is the request body for publishing an event.
type PublishEventRequest struct {
	EventType string `json:"event_type" binding:"required"`
	Payload   JSONB  `json:"payload"`
}

// UpdateSubscriptionRequest is the request body for toggling subscription enabled state.
type UpdateSubscriptionRequest struct {
	Enabled *bool `json:"enabled" binding:"required"`
}

// PaginatedRequest holds pagination query parameters.
type PaginatedRequest struct {
	Page     int `form:"page"`
	PageSize int `form:"page_size"`
}

func (p *PaginatedRequest) Offset() int {
	if p.Page <= 0 {
		p.Page = 1
	}
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	return (p.Page - 1) * p.PageSize
}

func (p *PaginatedRequest) Limit() int {
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	if p.PageSize > 100 {
		p.PageSize = 100
	}
	return p.PageSize
}
