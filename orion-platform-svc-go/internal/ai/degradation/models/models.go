package models

import "time"

// DegradationLevel represents the level of degradation.
type DegradationLevel string

const (
	DegradationLevelNone     DegradationLevel = "none"
	DegradationLevelMinor    DegradationLevel = "minor"
	DegradationLevelMajor    DegradationLevel = "major"
	DegradationLevelCritical DegradationLevel = "critical"
)

// DegradationConfig defines degradation settings.
type DegradationConfig struct {
	ID                string             `json:"id"`
	TenantID          string             `json:"tenant_id"`
	ServiceName       string             `json:"service_name"`
	Level             DegradationLevel   `json:"level"`
	Reason            string             `json:"reason"`
	BackoffMultiplier float64            `json:"backoff_multiplier"`
	RateLimit         int                `json:"rate_limit"`
	TimeoutMultiplier float64            `json:"timeout_multiplier"`
	Enabled           bool               `json:"enabled"`
	CreatedAt         time.Time          `json:"created_at"`
	UpdatedAt         time.Time          `json:"updated_at"`
}

// DegradationEvent represents a degradation event.
type DegradationEvent struct {
	ID        string             `json:"id"`
	TenantID  string             `json:"tenant_id"`
	Service   string             `json:"service"`
	Level     DegradationLevel   `json:"level"`
	Message   string             `json:"message"`
	TriggeredAt time.Time        `json:"triggered_at"`
	ResolvedAt *time.Time        `json:"resolved_at"`
}

// SetLevelRequest for setting degradation level.
type SetLevelRequest struct {
	Level    DegradationLevel `json:"level" binding:"required,oneof=none minor major critical"`
	Reason   string           `json:"reason"`
}

// DegradationResponse wraps degradation config.
type DegradationResponse struct {
	Total int64              `json:"total"`
	Data  []DegradationConfig `json:"data"`
}
