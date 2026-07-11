package models

import (
	"database/sql/driver"
	"encoding/json"
	"time"
)

// JSONB is a PostgreSQL JSONB-compatible map type.
type JSONB map[string]any

func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

func (j *JSONB) Scan(value any) error {
	if value == nil {
		*j = make(JSONB)
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		*j = make(JSONB)
		return nil
	}
	return json.Unmarshal(bytes, j)
}

// LogEventRequest is the inbound payload for logging an audit event.
type LogEventRequest struct {
	Action     string         `json:"action" binding:"required"`
	TargetType string         `json:"targetType" binding:"required"`
	TargetID   string         `json:"targetId" binding:"required"`
	Detail     map[string]any `json:"detail"`
	RequestID  string         `json:"requestId"`
}

// AuditSummary holds aggregate audit metrics.
type AuditSummary struct {
	TotalAuditLogs int            `json:"totalAuditLogs"`
	ByAction       map[string]int `json:"byAction"`
	LastActivity   time.Time      `json:"lastActivity"`
}

// DeleteBatchRequest carries batch delete IDs.
type DeleteBatchRequest struct {
	IDs []string `json:"ids" binding:"required"`
}

// AuditLog represents a single audit log entry (compatible with repository schema).
type AuditLog struct {
	ID         string  `db:"id" json:"id"`
	TenantID   string  `db:"tenant_id" json:"tenant_id"`
	Actor      string  `db:"actor" json:"actor"`
	Action     string  `db:"action" json:"action"`
	TargetType string  `db:"target_type" json:"target_type"`
	TargetID   string  `db:"target_id" json:"target_id"`
	Detail     JSONB   `db:"detail" json:"detail"`
	RequestID  string  `db:"request_id" json:"request_id"`
	CreatedAt  time.Time `db:"created_at" json:"created_at"`
}
