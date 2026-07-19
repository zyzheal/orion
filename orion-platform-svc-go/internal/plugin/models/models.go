package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// ---------------------------------------------------------------------------
// JSONB helper
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

type Plugin struct {
	ID          string    `db:"id"          json:"id"`
	TenantID    string    `db:"tenant_id"   json:"tenant_id"`
	Name        string    `db:"name"        json:"name"`
	Description string    `db:"description" json:"description,omitempty"`
	Version     string    `db:"version"     json:"version"`
	Author      string    `db:"author"      json:"author,omitempty"`
	Enabled     bool      `db:"enabled"     json:"enabled"`
	Config      JSONB     `db:"config"      json:"config,omitempty"`
	Entrypoint  string    `db:"entrypoint"  json:"entrypoint,omitempty"`
	CreatedAt   time.Time `db:"created_at"  json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at"  json:"updated_at"`
}

type CreatePluginRequest struct {
	Name        string `json:"name"        binding:"required"`
	Version     string `json:"version"     binding:"required"`
	Author      string `json:"author"`
	Description string `json:"description"`
	Entrypoint  string `json:"entrypoint"`
	Config      JSONB  `json:"config"`
}

type UpdatePluginRequest struct {
	Name        *string `json:"name"`
	Version     *string `json:"version"`
	Author      *string `json:"author"`
	Description *string `json:"description"`
	Entrypoint  *string `json:"entrypoint"`
	Config      JSONB   `json:"config"`
}

type PaginatedRequest struct {
	Page     int `form:"page"`
	PageSize int `form:"page_size"`
}

func (p *PaginatedRequest) Offset() int {
	if p.Page <= 0 {
		p.Page = 1
	}
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	return (p.Page - 1) * p.PageSize
}

func (p *PaginatedRequest) Limit() int {
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	if p.PageSize > 100 {
		p.PageSize = 100
	}
	return p.PageSize
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

type PluginExecution struct {
	ID            string     `db:"id"             json:"id"`
	PluginID      string     `db:"plugin_id"      json:"plugin_id"`
	TenantID      string     `db:"tenant_id"      json:"tenant_id"`
	TaskID        string     `db:"task_id"        json:"task_id"`
	PipelineRunID string     `db:"pipeline_run_id" json:"pipeline_run_id,omitempty"`
	StageID       string     `db:"stage_id"       json:"stage_id,omitempty"`
	Status        string     `db:"status"         json:"status"`
	ExitCode      *int       `db:"exit_code"      json:"exit_code,omitempty"`
	Stdout        string     `db:"stdout"         json:"stdout,omitempty"`
	Stderr        string     `db:"stderr"         json:"stderr,omitempty"`
	DurationMs    *int       `db:"duration_ms"    json:"duration_ms,omitempty"`
	ErrorMessage  string     `db:"error_message"  json:"error_message,omitempty"`
	Killed        bool       `db:"killed"         json:"killed"`
	KillReason    string     `db:"kill_reason"    json:"kill_reason,omitempty"`
	ResourceUsage JSONB      `db:"resource_usage" json:"resource_usage,omitempty"`
	StartedAt     time.Time  `db:"started_at"     json:"started_at"`
	CompletedAt   *time.Time `db:"completed_at"   json:"completed_at,omitempty"`
}

type ExecutePluginRequest struct {
	TaskID        string `json:"task_id"        binding:"required"`
	PipelineRunID string `json:"pipeline_run_id"`
	StageID       string `json:"stage_id"`
	Input         JSONB  `json:"input"`
}

type ExecutionResult struct {
	TaskID       string                 `json:"task_id"`
	Success      bool                   `json:"success"`
	ExitCode     int                    `json:"exit_code"`
	DurationMs   int                    `json:"duration_ms"`
	Stdout       string                 `json:"stdout,omitempty"`
	Stderr       string                 `json:"stderr,omitempty"`
	Output       map[string]interface{} `json:"output,omitempty"`
	ErrorMessage string                 `json:"error_message,omitempty"`
	Killed       bool                   `json:"killed"`
	KillReason   string                 `json:"kill_reason,omitempty"`
}

// ---------------------------------------------------------------------------
// Audit Entry
// ---------------------------------------------------------------------------

type AuditEntry struct {
	ID         string    `db:"id"          json:"id"`
	TenantID   string    `db:"tenant_id"   json:"tenant_id,omitempty"`
	PluginID   string    `db:"plugin_id"   json:"plugin_id,omitempty"`
	TaskID     string    `db:"task_id"     json:"task_id,omitempty"`
	Level      string    `db:"level"       json:"level"`
	Action     string    `db:"action"      json:"action"`
	Message    string    `db:"message"     json:"message,omitempty"`
	Input      JSONB     `db:"input"       json:"input,omitempty"`
	Output     JSONB     `db:"output"      json:"output,omitempty"`
	DurationMs *int      `db:"duration_ms" json:"duration_ms,omitempty"`
	Metadata   JSONB     `db:"metadata"    json:"metadata,omitempty"`
	EntryAt    time.Time `db:"entry_at"    json:"entry_at"`
}

type AuditLogFilter struct {
	TenantID string `form:"tenant_id"`
	PluginID string `form:"plugin_id"`
	TaskID   string `form:"task_id"`
	Level    string `form:"level"`
	Action   string `form:"action"`
	Limit    int    `form:"limit"`
}

func (f *AuditLogFilter) GetLimit() int {
	if f.Limit <= 0 || f.Limit > 500 {
		return 100
	}
	return f.Limit
}

// ---------------------------------------------------------------------------
// Security Event
// ---------------------------------------------------------------------------

type SecurityEvent struct {
	ID        string    `db:"id"         json:"id"`
	EventType string    `db:"event_type" json:"event_type"`
	Severity  string    `db:"severity"   json:"severity"`
	TaskID    string    `db:"task_id"    json:"task_id,omitempty"`
	PluginID  string    `db:"plugin_id"  json:"plugin_id,omitempty"`
	TenantID  string    `db:"tenant_id"  json:"tenant_id,omitempty"`
	Message   string    `db:"message"    json:"message,omitempty"`
	Details   JSONB     `db:"details"    json:"details,omitempty"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

type SecurityEventFilter struct {
	TenantID string `form:"tenant_id"`
	PluginID string `form:"plugin_id"`
	TaskID   string `form:"task_id"`
	Type     string `form:"type"`
	Severity string `form:"severity"`
	Limit    int    `form:"limit"`
}

func (f *SecurityEventFilter) GetLimit() int {
	if f.Limit <= 0 || f.Limit > 500 {
		return 100
	}
	return f.Limit
}

// ---------------------------------------------------------------------------
// Resource Quota
// ---------------------------------------------------------------------------

type ResourceQuota struct {
	CPUCores     int   `json:"cpu_cores"`
	MemoryBytes  int64 `json:"memory_bytes"`
	TimeoutMs    int   `json:"timeout_ms"`
	MaxConcurrent int  `json:"max_concurrent"`
}

type PluginResourceQuota struct {
	ID           string    `db:"id"            json:"id"`
	PluginID     string    `db:"plugin_id"     json:"plugin_id"`
	TenantID     string    `db:"tenant_id"     json:"tenant_id,omitempty"`
	CPUCores     int       `db:"cpu_cores"     json:"cpu_cores"`
	MemoryBytes  int64     `db:"memory_bytes"  json:"memory_bytes"`
	TimeoutMs    int       `db:"timeout_ms"    json:"timeout_ms"`
	MaxConcurrent int      `db:"max_concurrent" json:"max_concurrent"`
	CreatedAt    time.Time `db:"created_at"    json:"created_at"`
	UpdatedAt    time.Time `db:"updated_at"    json:"updated_at"`
}

type TenantQuota struct {
	ID           string    `db:"id"            json:"id"`
	TenantID     string    `db:"tenant_id"     json:"tenant_id"`
	CPUCores     int       `db:"cpu_cores"     json:"cpu_cores"`
	MemoryBytes  int64     `db:"memory_bytes"  json:"memory_bytes"`
	TimeoutMs    int       `db:"timeout_ms"    json:"timeout_ms"`
	MaxConcurrent int      `db:"max_concurrent" json:"max_concurrent"`
	CreatedAt    time.Time `db:"created_at"    json:"created_at"`
	UpdatedAt    time.Time `db:"updated_at"    json:"updated_at"`
}

// ---------------------------------------------------------------------------
// Resource Usage (runtime, not persisted directly)
// ---------------------------------------------------------------------------

type ResourceUsage struct {
	CPUPercent    float64   `json:"cpu_percent"`
	MemoryBytes   int64     `json:"memory_bytes"`
	DiskBytes     int64     `json:"disk_bytes"`
	NetworkRxBytes int64    `json:"network_rx_bytes"`
	NetworkTxBytes int64    `json:"network_tx_bytes"`
	Timestamp     time.Time `json:"timestamp"`
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

type ValidationResult struct {
	Valid  bool              `json:"valid"`
	Errors []ValidationError `json:"errors,omitempty"`
}

type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// ---------------------------------------------------------------------------
// DLP
// ---------------------------------------------------------------------------

type DLPDetectionResult struct {
	HasSensitiveData bool        `json:"has_sensitive_data"`
	Patterns         []DLPPattern `json:"patterns,omitempty"`
	RedactedData     string      `json:"redacted_data,omitempty"`
}

type DLPPattern struct {
	Type     string `json:"type"`
	Matched  string `json:"matched_text"`
	Start    int    `json:"start"`
	End      int    `json:"end"`
	Confidence float64 `json:"confidence"`
}

// ---------------------------------------------------------------------------
// Quota update request
// ---------------------------------------------------------------------------

type UpdateQuotaRequest struct {
	CPUCores     *int   `json:"cpu_cores"`
	MemoryBytes  *int64 `json:"memory_bytes"`
	TimeoutMs    *int   `json:"timeout_ms"`
	MaxConcurrent *int  `json:"max_concurrent"`
}
