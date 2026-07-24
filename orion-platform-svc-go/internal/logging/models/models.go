// Package models defines data structures for the centralized logging service.
package models

import (
	"encoding/json"
	"time"
)

// LogEntry represents a single structured log record.
type LogEntry struct {
	ID        string            `json:"id" db:"id"`
	TenantID  string            `json:"tenantId" db:"tenant_id"`
	Service   string            `json:"service" db:"service"`
	Level     string            `json:"level" db:"level"` // DEBUG, INFO, WARN, ERROR
	Message   string            `json:"message" db:"message"`
	Timestamp time.Time         `json:"timestamp" db:"timestamp"`
	TraceID   string            `json:"traceId" db:"trace_id"`
	Metadata  json.RawMessage   `json:"metadata" db:"metadata"`
	CreatedAt time.Time         `json:"createdAt" db:"created_at"`
}

// LogQuery defines filter criteria for searching log entries.
type LogQuery struct {
	TenantID  string    `json:"tenantId"`
	Service   string    `json:"service"`
	Level     string    `json:"level"`
	TimeFrom  time.Time `json:"timeFrom"`
	TimeTo    time.Time `json:"timeTo"`
	Keywords  []string  `json:"keywords"`
	TraceID   string    `json:"traceId"`
	Page      int       `json:"page"`
	PageSize  int       `json:"pageSize"`
}

// IngestLogRequest is the request body for ingesting log entries.
type IngestLogRequest struct {
	Service  string           `json:"service" binding:"required"`
	Level    string           `json:"level" binding:"required"`
	Message  string           `json:"message" binding:"required"`
	Timestamp *time.Time     `json:"timestamp"`
	TraceID  string           `json:"traceId"`
	Metadata map[string]interface{} `json:"metadata"`
}

// LogAggregation represents aggregated log statistics.
type LogAggregation struct {
	Total    int64             `json:"total"`
	ByLevel  map[string]int64  `json:"byLevel"`
	ByService map[string]int64 `json:"byService"`
	TimeRange struct {
		From time.Time `json:"from"`
		To   time.Time `json:"to"`
	} `json:"timeRange"`
}
