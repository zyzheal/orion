package models

import (
	"time"

	"github.com/google/uuid"
)

// Silence represents an alert silence configuration.
type Silence struct {
	ID          uuid.UUID `json:"id"`
	TenantID    uuid.UUID `json:"tenant_id"`
	AlertID     *uuid.UUID `json:"alert_id,omitempty"`
	Matcher     string    `json:"matcher,omitempty"`
	Duration    int       `json:"duration"`
	Reason      string    `json:"reason"`
	CreatedBy   string    `json:"created_by"`
	ExpiresAt   time.Time `json:"expires_at"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// CreateSilenceRequest for creating a silence.
type CreateSilenceRequest struct {
	AlertID *uuid.UUID `json:"alert_id,omitempty"`
	Matcher string     `json:"matcher,omitempty"`
	Duration int       `json:"duration" binding:"required,min=60"`
	Reason  string     `json:"reason" binding:"required,max=500"`
}

// SilenceResponse wraps silence query results.
type SilenceResponse struct {
	Total int64     `json:"total"`
	Data  []Silence `json:"data"`
}
