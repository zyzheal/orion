package models

import "time"

// AlertBreaker represents a circuit-breaker rule for alert handling.
type AlertBreaker struct {
	ID          string            `db:"id" json:"id"`
	TenantID    string            `db:"tenant_id" json:"tenant_id"`
	Name        string            `db:"name" json:"name"`
	Description string            `db:"description" json:"description"`
	AlertID     string            `db:"alert_id" json:"alert_id"`
	Rule        map[string]string `db:"rule" json:"rule"`
	Status      string            `db:"status" json:"status"` // active|inactive|open|half-open
	CreatedAt   time.Time         `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time         `db:"updated_at" json:"updated_at"`
}

// CreateAlertBreakerRequest is the request body for creating an alert breaker.
type CreateAlertBreakerRequest struct {
	Name        string            `json:"name" binding:"required"`
	Description string            `json:"description"`
	AlertID     string            `json:"alertId"`
	Rule        map[string]string `json:"rule"`
}

// UpdateAlertBreakerRequest is the request body for updating an alert breaker.
type UpdateAlertBreakerRequest struct {
	Name        *string           `json:"name"`
	Description *string           `json:"description"`
	Status      *string           `json:"status"`
	Rule        map[string]string `json:"rule"`
}
