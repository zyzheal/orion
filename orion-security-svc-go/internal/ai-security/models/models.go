package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// JSONB is a convenience type for PostgreSQL JSONB columns.
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

// JSONArray is a convenience type for PostgreSQL JSONB array columns.
type JSONArray []interface{}

func (a JSONArray) Value() (driver.Value, error) {
	if a == nil {
		return nil, nil
	}
	return json.Marshal(a)
}

func (a *JSONArray) Scan(src interface{}) error {
	if src == nil {
		*a = nil
		return nil
	}
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, a)
	case string:
		return json.Unmarshal([]byte(v), a)
	default:
		return fmt.Errorf("cannot scan %T into JSONArray", src)
	}
}

// ScanRequest is the input for running a security scan.
type ScanRequest struct {
	Input string `json:"input" binding:"required"`
}

// ScanResult is the output of a security scan.
type ScanResult struct {
	ID            string    `json:"id"`
	Input         string    `json:"input"`
	UserID        string    `json:"user_id"`
	TenantID        string    `json:"tenant_id"`
	SessionID       string    `json:"session_id"`
	RiskScore       float64   `json:"risk_score"`
	Sanitized       bool      `json:"sanitized"`
	HasViolation    bool      `json:"has_violation"`
	Violations      []string  `json:"violations"`
	Recommendation  string    `json:"recommendation"`
	ScannedAt       time.Time `json:"scanned_at"`
}

// SecurityPolicy represents a configurable security policy.
type SecurityPolicy struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Enabled     bool   `json:"enabled"`
	Description string `json:"description"`
	Settings    JSONB  `json:"settings"`
}

// SecurityAlert represents a security alert from a scan.
type SecurityAlert struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	SessionID   string    `json:"session_id"`
	RiskScore   float64   `json:"risk_score"`
	Violations  []string  `json:"violations"`
	ScannedAt   time.Time `json:"timestamp"`
}

// PolicyInput is the input for updating a policy.
type PolicyInput struct {
	Enabled *bool `json:"enabled"`
}

// AuditFilter is used to filter audit logs/alerts.
type AuditFilter struct {
	UserID    string    `json:"user_id"`
	Action    string    `json:"action"`
	StartTime time.Time `json:"start_time"`
	EndTime   time.Time `json:"end_time"`
	SessionID string    `json:"session_id"`
}
