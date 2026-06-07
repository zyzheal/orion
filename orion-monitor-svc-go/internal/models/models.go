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

// ==================== Metric Aggregation ====================

// MetricAggregation holds aggregated statistics over a time series.
type MetricAggregation struct {
	Avg   float64 `json:"avg"`
	Max   float64 `json:"max"`
	Min   float64 `json:"min"`
	P95   float64 `json:"p95"`
	P99   float64 `json:"p99"`
	Count int64   `json:"count"`
	Sum   float64 `json:"sum"`
}

// MetricAggregationResult pairs a metric name with its aggregation.
type MetricAggregationResult struct {
	Name        string             `json:"name"`
	Aggregation MetricAggregation  `json:"aggregation"`
}

// GetMetricAggregationRequest is the request for metric aggregation queries.
type GetMetricAggregationRequest struct {
	MetricName string    `form:"metric_name" binding:"required"`
	StartTime  time.Time `form:"start_time"`
	EndTime    time.Time `form:"end_time"`
	WindowMs   int       `form:"window_ms"`
}

// ==================== System Metrics ====================

// SystemMetrics holds collected system-level metrics.
type SystemMetrics struct {
	CPUUsage     float64   `json:"cpu_usage"`
	MemoryUsage  float64   `json:"memory_usage"`
	MemoryUsed   uint64    `json:"memory_used"`
	MemoryTotal  uint64    `json:"memory_total"`
	LoadAvg1m    float64   `json:"load_avg_1m"`
	LoadAvg5m    float64   `json:"load_avg_5m"`
	LoadAvg15m   float64   `json:"load_avg_15m"`
	Goroutines   int       `json:"goroutines"`
	Hostname     string    `json:"hostname"`
	CollectedAt  time.Time `json:"collected_at"`
}

// RegisterMetricRequest is the request body for registering a custom metric.
type RegisterMetricRequest struct {
	Name        string            `json:"name" binding:"required"`
	Unit        string            `json:"unit" binding:"required"`
	DefaultTags map[string]string `json:"default_tags"`
	Description string            `json:"description"`
}

// ==================== Dashboard ====================

// TimeWindow represents a time window for aggregation.
type TimeWindow string

const (
	TimeWindow1m  TimeWindow = "1m"
	TimeWindow5m  TimeWindow = "5m"
	TimeWindow15m TimeWindow = "15m"
	TimeWindow1h  TimeWindow = "1h"
	TimeWindow6h  TimeWindow = "6h"
	TimeWindow24h TimeWindow = "24h"
	TimeWindow7d  TimeWindow = "7d"
)

// TimeWindowToMs converts a TimeWindow string to milliseconds.
func TimeWindowToMs(window TimeWindow) int64 {
	switch window {
	case TimeWindow1m:
		return 60 * 1000
	case TimeWindow5m:
		return 5 * 60 * 1000
	case TimeWindow15m:
		return 15 * 60 * 1000
	case TimeWindow1h:
		return 60 * 60 * 1000
	case TimeWindow6h:
		return 6 * 60 * 60 * 1000
	case TimeWindow24h:
		return 24 * 60 * 60 * 1000
	case TimeWindow7d:
		return 7 * 24 * 60 * 60 * 1000
	default:
		return 60 * 60 * 1000
	}
}

// DashboardWidgetConfig stores a dashboard widget definition.
type DashboardWidgetConfig struct {
	ID         uuid.UUID       `json:"id"`
	TenantID   uuid.UUID       `json:"tenant_id"`
	Title      string          `json:"title"`
	Metrics    json.RawMessage `json:"metrics"`
	TimeWindow string          `json:"time_window"`
	Tags       json.RawMessage `json:"tags,omitempty"`
	SortOrder  int             `json:"sort_order"`
	CreatedAt  time.Time       `json:"created_at"`
}

// CreateWidgetConfigRequest is the request body for creating a widget config.
type CreateWidgetConfigRequest struct {
	Title      string            `json:"title" binding:"required"`
	Metrics    []string          `json:"metrics" binding:"required"`
	TimeWindow string            `json:"time_window" binding:"required"`
	Tags       map[string]string `json:"tags"`
}

// DashboardWidget holds generated widget data for the dashboard.
type DashboardWidget struct {
	Title        string                `json:"title"`
	Metrics      []string              `json:"metrics"`
	Series       []MetricSeriesSummary `json:"series"`
	CurrentValue *float64              `json:"current_value,omitempty"`
	Trend        string                `json:"trend"`
	HasAnomaly   bool                  `json:"has_anomaly"`
}

// MetricSeriesSummary is a lightweight metric series for dashboard.
type MetricSeriesSummary struct {
	Name        string            `json:"name"`
	Aggregation MetricAggregation `json:"aggregation"`
	DataPoints  int               `json:"data_points"`
}

// AnomalyResult represents a detected anomaly.
type AnomalyResult struct {
	Metric        string    `json:"metric"`
	Timestamp     time.Time `json:"timestamp"`
	Value         float64   `json:"value"`
	ExpectedValue float64   `json:"expected_value"`
	ZScore        float64   `json:"z_score"`
	IsAnomaly     bool      `json:"is_anomaly"`
}

// DashboardData is the complete dashboard response.
type DashboardData struct {
	Widgets      []DashboardWidget   `json:"widgets"`
	HealthScore  int                 `json:"health_score"`
	ActiveAlerts map[string]int      `json:"active_alerts"`
	Anomalies    []AnomalyResult     `json:"anomalies"`
	GeneratedAt  time.Time           `json:"generated_at"`
}

// ==================== Health Status ====================

// HealthStatus is the detailed service health response.
type HealthStatus struct {
	Status       string `json:"status"`
	Service      string `json:"service"`
	Running      bool   `json:"running"`
	Uptime       string `json:"uptime"`
	MetricsCount int    `json:"metrics_count"`
	RulesCount   int    `json:"rules_count"`
	ActiveAlerts int    `json:"active_alerts"`
}
