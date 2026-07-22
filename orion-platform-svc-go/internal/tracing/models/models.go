package models

import "time"

// TraceSpan represents a distributed trace span.
type TraceSpan struct {
	ID            string            `db:"id" json:"id"`
	TenantID      string            `db:"tenant_id" json:"tenant_id"`
	TraceID       string            `db:"trace_id" json:"traceId"`
	ParentSpanID  string            `db:"parent_span_id" json:"parentSpanId"`
	SpanID        string            `db:"span_id" json:"spanId"`
	ServiceName   string            `db:"service_name" json:"serviceName"`
	OperationName string            `db:"operation_name" json:"operationName"`
	StatusCode    int               `db:"status_code" json:"statusCode"`
	Duration      float64           `db:"duration" json:"duration"` // milliseconds
	Tags          map[string]string `db:"tags" json:"tags"`
	CreatedAt     time.Time         `db:"created_at" json:"createdAt"`
}

// TraceSamplingConfig controls trace sampling per service.
type TraceSamplingConfig struct {
	ID             string    `db:"id" json:"id"`
	TenantID       string    `db:"tenant_id" json:"tenant_id"`
	ServiceName    string    `db:"service_name" json:"serviceName"`
	SampleRate     float64   `db:"sample_rate" json:"sampleRate"`
	MaxSpansPerSec int       `db:"max_spans_per_sec" json:"maxSpansPerSec"`
	Enabled        bool      `db:"enabled" json:"enabled"`
	CreatedAt      time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt      time.Time `db:"updated_at" json:"updatedAt"`
}

// OtelCollectorConfig represents an OTel collector configuration.
type OtelCollectorConfig struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	Name        string    `db:"name" json:"name"`
	Description string    `db:"description" json:"description"`
	ConfigType  string    `db:"config_type" json:"configType"`
	ConfigYaml  string    `db:"config_yaml" json:"configYaml"`
	Enabled     bool      `db:"enabled" json:"enabled"`
	CreatedAt   time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt   time.Time `db:"updated_at" json:"updatedAt"`
}

// TraceSearchRequest searches traces by filters.
type TraceSearchRequest struct {
	ServiceName   string  `json:"serviceName"`
	OperationName string  `json:"operationName"`
	MinDuration   float64 `json:"minDuration"`
	MaxDuration   float64 `json:"maxDuration"`
	StatusCode    int     `json:"statusCode"`
	StartTime     string  `json:"startTime"`
	EndTime       string  `json:"endTime"`
	Limit         int     `json:"limit"`
	Offset        int     `json:"offset"`
}

// UpsertSamplingRequest for updating sampling config.
type UpsertSamplingRequest struct {
	ServiceName    string  `json:"serviceName" binding:"required"`
	SampleRate     float64 `json:"sampleRate"`
	MaxSpansPerSec int     `json:"maxSpansPerSec"`
	Enabled        bool    `json:"enabled"`
}

// CreateOtelRequest for creating OTel collector config.
type CreateOtelRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	ConfigType  string `json:"configType" binding:"required"`
	ConfigYaml  string `json:"configYaml"`
	Enabled     bool   `json:"enabled"`
}

// UpdateOtelRequest for updating OTel collector config.
type UpdateOtelRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	ConfigType  *string `json:"configType"`
	ConfigYaml  *string `json:"configYaml"`
	Enabled     *bool   `json:"enabled"`
}
