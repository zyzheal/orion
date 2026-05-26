package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// Metric represents a single metric data point.
type Metric struct {
	ID         uuid.UUID       `json:"id"`
	TenantID   uuid.UUID       `json:"tenant_id"`
	MetricName string          `json:"metric_name"`
	Value      float64         `json:"value"`
	Tags       json.RawMessage `json:"tags,omitempty"`
	Timestamp  time.Time       `json:"timestamp"`
	CreatedAt  time.Time       `json:"created_at"`
}

// MetricQueryRequest is the request body for querying metrics.
type MetricQueryRequest struct {
	MetricName string            `json:"metric_name" binding:"required"`
	StartTime  time.Time         `json:"start_time"`
	EndTime    time.Time         `json:"end_time"`
	Tags       map[string]string `json:"tags"`
	Limit      int               `json:"limit"`
	Offset     int               `json:"offset"`
}

// MetricResponse wraps metric query results.
type MetricResponse struct {
	Total int64    `json:"total"`
	Data  []Metric `json:"data"`
}

// Trace represents a distributed trace span.
type Trace struct {
	ID             uuid.UUID       `json:"id"`
	TenantID       uuid.UUID       `json:"tenant_id"`
	TraceID        string          `json:"trace_id"`
	SpanID         string          `json:"span_id"`
	ParentSpanID   *string         `json:"parent_span_id,omitempty"`
	ServiceName    string          `json:"service_name"`
	OperationName  string          `json:"operation_name"`
	Status         string          `json:"status"`
	DurationMs     int             `json:"duration_ms"`
	Attributes     json.RawMessage `json:"attributes,omitempty"`
	CreatedAt      time.Time       `json:"created_at"`
}

// TraceQueryRequest is the request for querying traces.
type TraceQueryRequest struct {
	ServiceName   string    `json:"service_name"`
	OperationName string    `json:"operation_name"`
	Status        string    `json:"status"`
	MinDurationMs int       `json:"min_duration_ms"`
	MaxDurationMs int       `json:"max_duration_ms"`
	StartTime     time.Time `json:"start_time"`
	EndTime       time.Time `json:"end_time"`
	Limit         int       `json:"limit"`
	Offset        int       `json:"offset"`
}

// TraceResponse wraps trace query results.
type TraceResponse struct {
	Total int64   `json:"total"`
	Data  []Trace `json:"data"`
}

// ServiceOverview represents a service's APM summary.
type ServiceOverview struct {
	ServiceName     string  `json:"service_name"`
	RequestCount    int64   `json:"request_count"`
	ErrorRate       float64 `json:"error_rate"`
	AvgDurationMs   float64 `json:"avg_duration_ms"`
	P95DurationMs   float64 `json:"p95_duration_ms"`
	P99DurationMs   float64 `json:"p99_duration_ms"`
	ActiveTraces    int64   `json:"active_traces"`
	LastSeen        time.Time `json:"last_seen"`
}

// Alert represents an alert instance.
type Alert struct {
	ID          uuid.UUID  `json:"id"`
	TenantID    uuid.UUID  `json:"tenant_id"`
	RuleName    string     `json:"rule_name"`
	Severity    string     `json:"severity"`
	Status      string     `json:"status"`
	Description string     `json:"description"`
	TriggeredAt time.Time  `json:"triggered_at"`
	ResolvedAt  *time.Time `json:"resolved_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}

// AlertQueryRequest filters alerts.
type AlertQueryRequest struct {
	Status   string `form:"status"`
	Severity string `form:"severity"`
	Limit    int    `form:"limit"`
	Offset   int    `form:"offset"`
}

// AlertResponse wraps alert query results.
type AlertResponse struct {
	Total int64   `json:"total"`
	Data  []Alert `json:"data"`
}

// AlertRule represents a monitoring alert rule.
type AlertRule struct {
	ID                  uuid.UUID `json:"id"`
	TenantID            uuid.UUID `json:"tenant_id"`
	Name                string    `json:"name"`
	MetricName          string    `json:"metric_name"`
	Operator            string    `json:"operator"`
	Threshold           float64   `json:"threshold"`
	EvaluationIntervalSec int     `json:"evaluation_interval_sec"`
	IsEnabled           bool      `json:"is_enabled"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

// CreateAlertRuleRequest is the request body for creating an alert rule.
type CreateAlertRuleRequest struct {
	Name                string  `json:"name" binding:"required"`
	MetricName          string  `json:"metric_name" binding:"required"`
	Operator            string  `json:"operator" binding:"required,oneof=> < >= <="`
	Threshold           float64 `json:"threshold" binding:"required"`
	EvaluationIntervalSec int   `json:"evaluation_interval_sec" binding:"required,min=5"`
	IsEnabled           *bool   `json:"is_enabled"`
}

// UpdateAlertRuleRequest is the request body for updating an alert rule.
type UpdateAlertRuleRequest struct {
	Name                string  `json:"name"`
	MetricName          string  `json:"metric_name"`
	Operator            string  `json:"operator" binding:"omitempty,oneof=> < >= <="`
	Threshold           float64 `json:"threshold"`
	EvaluationIntervalSec int   `json:"evaluation_interval_sec" binding:"omitempty,min=5"`
	IsEnabled           *bool   `json:"is_enabled"`
}

// AlertRuleResponse wraps alert rule query results.
type AlertRuleResponse struct {
	Total int64       `json:"total"`
	Data  []AlertRule `json:"data"`
}

// SilenceAlertRequest for silencing an alert.
type SilenceAlertRequest struct {
	DurationSec int    `json:"duration_sec"`
	Reason      string `json:"reason"`
}
