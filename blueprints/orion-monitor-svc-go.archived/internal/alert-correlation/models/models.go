package models

import (
	"time"

	"github.com/google/uuid"
)

// CorrelationGroup represents a group of correlated alerts.
type CorrelationGroup struct {
	ID          uuid.UUID `json:"id"`
	TenantID    uuid.UUID `json:"tenant_id"`
	RootAlertID uuid.UUID `json:"root_alert_id"`
	AlertIDs    []uuid.UUID `json:"alert_ids"`
	GroupType   string    `json:"group_type"` // temporal, spatial, causal
	Confidence  float64   `json:"confidence"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// CorrelationRule defines a rule for correlating alerts.
type CorrelationRule struct {
	ID            uuid.UUID `json:"id"`
	TenantID      uuid.UUID `json:"tenant_id"`
	Name          string    `json:"name"`
	Description   string    `json:"description"`
	GroupType     string    `json:"group_type"` // temporal, spatial, causal
	TimeWindowSec int       `json:"time_window_sec"`
	IsEnabled     bool      `json:"is_enabled"`
	Conditions    string    `json:"conditions"`
	CreatedAt     time.Time `json:"created_at"`
}

// CorrelationResult is the result of a correlation analysis.
type CorrelationResult struct {
	Groups []CorrelationGroup `json:"groups"`
	Total  int64              `json:"total"`
}

// CreateCorrelationGroupRequest for creating a correlation group.
type CreateCorrelationGroupRequest struct {
	RootAlertID uuid.UUID  `json:"root_alert_id" binding:"required"`
	AlertIDs    []uuid.UUID `json:"alert_ids" binding:"required"`
	GroupType   string     `json:"group_type" binding:"required,oneof=temporal spatial causal"`
}
