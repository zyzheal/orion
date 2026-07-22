package models

import (
	"database/sql/driver"
	"encoding/json"
	"time"
)

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

// CheckType is the type of health check to perform.
type CheckType string

const (
	CheckTypeHTTP    CheckType = "HTTP"
	CheckTypeTCP     CheckType = "TCP"
	CheckTypeCommand CheckType = "Command"
)

// ValidCheckTypes returns all allowed check types.
func ValidCheckTypes() []CheckType {
	return []CheckType{CheckTypeHTTP, CheckTypeTCP, CheckTypeCommand}
}

// LastStatus is the most recent result of a health check.
type LastStatus string

const (
	StatusUP      LastStatus = "UP"
	StatusDOWN    LastStatus = "DOWN"
	StatusUNKNOWN LastStatus = "UNKNOWN"
)

// ValidLastStatuses returns all allowed status values.
func ValidLastStatuses() []LastStatus {
	return []LastStatus{StatusUP, StatusDOWN, StatusUNKNOWN}
}

// Metadata is a JSONB-compatible map[string]string used for storing
// arbitrary key/value pairs with a HealthCheck record.
type Metadata map[string]string

// Scan implements sql.Scanner for Metadata (JSONB).
func (m *Metadata) Scan(value interface{}) error {
	if value == nil {
		*m = make(map[string]string)
		return nil
	}
	b, ok := value.([]byte)
	if !ok {
		return nil
	}
	if err := json.Unmarshal(b, m); err != nil {
		return err
	}
	return nil
}

// Value implements driver.Valuer for Metadata (JSONB).
func (m Metadata) Value() (driver.Value, error) {
	if m == nil {
		m = make(map[string]string)
	}
	b, err := json.Marshal(m)
	if err != nil {
		return nil, err
	}
	return b, nil
}

// ---------------------------------------------------------------------------
// Domain model
// ---------------------------------------------------------------------------

// HealthCheck represents a configured health check for a service.
type HealthCheck struct {
	ID                  string     `json:"id" db:"id"`
	TenantID            string     `json:"tenant_id" db:"tenant_id"`
	ServiceName         string     `json:"service_name" db:"service_name"`
	CheckType           CheckType  `json:"check_type" db:"check_type"`
	Endpoint            string     `json:"endpoint" db:"endpoint"`
	IntervalSeconds     int        `json:"interval_seconds" db:"interval_seconds"`
	TimeoutSeconds      int        `json:"timeout_seconds" db:"timeout_seconds"`
	LastStatus          LastStatus `json:"last_status" db:"last_status"`
	LastCheckAt         *time.Time `json:"last_check_at,omitempty" db:"last_check_at"`
	ConsecutiveFailures int        `json:"consecutive_failures" db:"consecutive_failures"`
	Metadata            Metadata   `json:"metadata" db:"metadata"`
	Enabled             bool       `json:"enabled" db:"enabled"`
	CreatedAt           time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at" db:"updated_at"`
}

// HealthResult represents the result of a single health check execution.
type HealthResult struct {
	CheckID        string     `json:"check_id" db:"check_id"`
	Status         LastStatus `json:"status" db:"status"`
	ResponseTimeMs int64      `json:"response_time_ms" db:"response_time_ms"`
	Error          string     `json:"error" db:"error"`
	CheckedAt      time.Time  `json:"checked_at" db:"checked_at"`
}

// HealthSummary holds aggregated health information for a service.
type HealthSummary struct {
	ServiceName   string     `json:"service_name"`
	Status        LastStatus `json:"status"`
	UptimePercent float64    `json:"uptime_percent"`
	LastCheckAt   *time.Time `json:"last_check_at"`
	TotalChecks   int        `json:"total_checks"`
	FailedChecks  int        `json:"failed_checks"`
}

// ---------------------------------------------------------------------------
// Request / response models
// ---------------------------------------------------------------------------

// CreateHealthCheckRequest is the request body for creating a health check.
type CreateHealthCheckRequest struct {
	ServiceName     string            `json:"service_name" binding:"required"`
	CheckType       CheckType         `json:"check_type" binding:"required"`
	Endpoint        string            `json:"endpoint" binding:"required"`
	IntervalSeconds int               `json:"interval_seconds"`
	TimeoutSeconds  int               `json:"timeout_seconds"`
	Metadata        map[string]string `json:"metadata"`
	Enabled         bool              `json:"enabled"`
}

// UpdateHealthCheckRequest is the request body for updating a health check.
type UpdateHealthCheckRequest struct {
	ServiceName     *string            `json:"service_name"`
	CheckType       *CheckType         `json:"check_type"`
	Endpoint        *string            `json:"endpoint"`
	IntervalSeconds *int               `json:"interval_seconds"`
	TimeoutSeconds  *int               `json:"timeout_seconds"`
	Metadata        *map[string]string `json:"metadata"`
	Enabled         *bool              `json:"enabled"`
}

// RecordHealthResultRequest is the request body for recording a health result.
type RecordHealthResultRequest struct {
	Status         LastStatus `json:"status" binding:"required"`
	ResponseTimeMs int64      `json:"response_time_ms"`
	Error          string     `json:"error"`
}
