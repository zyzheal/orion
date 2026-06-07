package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// JSONB is a map type that marshals/unmarshals to PostgreSQL JSONB columns.
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

// JSONArray is a slice type that marshals/unmarshals to PostgreSQL JSONB columns.
type JSONArray []string

func (a JSONArray) Value() (driver.Value, error) {
	if a == nil {
		return []byte("[]"), nil
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

// ==================== Runner ====================

// Runner represents a remote execution agent that processes pipeline tasks.
type Runner struct {
	ID            string    `db:"id" json:"id"`
	TenantID      string    `db:"tenant_id" json:"tenant_id"`
	Name          string    `db:"name" json:"name"`
	Type          string    `db:"type" json:"type"`
	Status        string    `db:"status" json:"status"`
	Endpoint      string    `db:"endpoint" json:"endpoint,omitempty"`
	Capacity      int       `db:"capacity" json:"capacity"`
	MaxConcurrent int       `db:"max_concurrent" json:"max_concurrent"`
	CurrentJobs   int       `db:"current_jobs" json:"current_jobs"`
	Labels        JSONArray `db:"labels" json:"labels"`
	Metadata      JSONB     `db:"metadata" json:"metadata,omitempty"`
	LastHeartbeat *time.Time `db:"last_heartbeat" json:"last_heartbeat,omitempty"`
	CreatedAt     time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt     time.Time  `db:"updated_at" json:"updated_at"`
}

// CreateRunnerRequest is the payload for registering a new runner.
type CreateRunnerRequest struct {
	Name          string            `json:"name" binding:"required"`
	Type          string            `json:"type" binding:"required"`
	Endpoint      string            `json:"endpoint"`
	MaxConcurrent int               `json:"max_concurrent"`
	Labels        []string          `json:"labels"`
	Metadata      map[string]interface{} `json:"metadata"`
}

// UpdateRunnerRequest is the payload for updating a runner.
type UpdateRunnerRequest struct {
	Status        *string           `json:"status"`
	Endpoint      *string           `json:"endpoint"`
	MaxConcurrent *int              `json:"max_concurrent"`
	Labels        []string          `json:"labels"`
	Metadata      map[string]interface{} `json:"metadata"`
}

// ==================== PipelineRun ====================

// PipelineRun represents a single execution of a pipeline.
type PipelineRun struct {
	ID              string    `db:"id" json:"id"`
	TenantID        string    `db:"tenant_id" json:"tenant_id"`
	PipelineID      string    `db:"pipeline_id" json:"pipeline_id"`
	TriggerType     string    `db:"trigger_type" json:"trigger_type"`
	TriggerBy       *string   `db:"trigger_by" json:"trigger_by,omitempty"`
	Status          string    `db:"status" json:"status"`
	EnvironmentName *string   `db:"environment_name" json:"environment_name,omitempty"`
	ConfigSnapshot  JSONB     `db:"config_snapshot" json:"config_snapshot,omitempty"`
	ErrorMessage    *string   `db:"error_message" json:"error_message,omitempty"`
	StartedAt       *time.Time `db:"started_at" json:"started_at,omitempty"`
	CompletedAt     *time.Time `db:"completed_at" json:"completed_at,omitempty"`
	DurationMs      *int64    `db:"duration_ms" json:"duration_ms,omitempty"`
	CreatedAt       time.Time `db:"created_at" json:"created_at"`
}

// CreatePipelineRunRequest is the payload for creating a pipeline run.
type CreatePipelineRunRequest struct {
	PipelineID      string                 `json:"pipeline_id" binding:"required"`
	TriggerType     string                 `json:"trigger_type"`
	TriggerBy       string                 `json:"trigger_by"`
	EnvironmentName string                 `json:"environment_name"`
	ConfigSnapshot  map[string]interface{} `json:"config_snapshot"`
}

// ==================== StageExecution ====================

// StageExecution represents the execution of a pipeline stage within a run.
type StageExecution struct {
	ID           string     `db:"id" json:"id"`
	RunID        string     `db:"run_id" json:"run_id"`
	StageID      *string    `db:"stage_id" json:"stage_id,omitempty"`
	StageName    string     `db:"stage_name" json:"stage_name"`
	Status       string     `db:"status" json:"status"`
	ErrorMessage *string    `db:"error_message" json:"error_message,omitempty"`
	Logs         *string    `db:"logs" json:"logs,omitempty"`
	StartedAt    *time.Time `db:"started_at" json:"started_at,omitempty"`
	CompletedAt  *time.Time `db:"completed_at" json:"completed_at,omitempty"`
	DurationMs   *int64     `db:"duration_ms" json:"duration_ms,omitempty"`
	CreatedAt    time.Time  `db:"created_at" json:"created_at"`
}

// ==================== TaskExecution ====================

// TaskExecution represents the execution of an individual task within a stage.
type TaskExecution struct {
	ID           string     `db:"id" json:"id"`
	ExecutionID  string     `db:"execution_id" json:"execution_id"`
	TaskName     string     `db:"task_name" json:"task_name"`
	TaskType     string     `db:"task_type" json:"task_type"`
	Status       string     `db:"status" json:"status"`
	Input        JSONB      `db:"input" json:"input,omitempty"`
	Output       JSONB      `db:"output" json:"output,omitempty"`
	ErrorMessage *string    `db:"error_message" json:"error_message,omitempty"`
	Logs         *string    `db:"logs" json:"logs,omitempty"`
	StartedAt    *time.Time `db:"started_at" json:"started_at,omitempty"`
	CompletedAt  *time.Time `db:"completed_at" json:"completed_at,omitempty"`
	DurationMs   *int64     `db:"duration_ms" json:"duration_ms,omitempty"`
	CreatedAt    time.Time  `db:"created_at" json:"created_at"`
}

// ==================== RunnerJob ====================

// RunnerJob tracks task dispatch to a remote runner.
type RunnerJob struct {
	ID          string     `db:"id" json:"id"`
	RunnerID    string     `db:"runner_id" json:"runner_id"`
	TaskID      string     `db:"task_id" json:"task_id"`
	StageID     *string    `db:"stage_id" json:"stage_id,omitempty"`
	RunID       *string    `db:"run_id" json:"run_id,omitempty"`
	TenantID    string     `db:"tenant_id" json:"tenant_id"`
	Status      string     `db:"status" json:"status"`
	Result      JSONB      `db:"result" json:"result,omitempty"`
	Error       *string    `db:"error" json:"error,omitempty"`
	StartedAt   *time.Time `db:"started_at" json:"started_at,omitempty"`
	CompletedAt *time.Time `db:"completed_at" json:"completed_at,omitempty"`
	CreatedAt   time.Time  `db:"created_at" json:"created_at"`
}

// CreateRunnerJobRequest is the payload for creating a runner job.
type CreateRunnerJobRequest struct {
	RunnerID string `json:"runner_id" binding:"required"`
	TaskID   string `json:"task_id" binding:"required"`
	StageID  string `json:"stage_id"`
	RunID    string `json:"run_id"`
}

// ==================== Pagination ====================

// PaginatedRequest holds pagination parameters.
type PaginatedRequest struct {
	Page     int `form:"page"`
	PageSize int `form:"page_size"`
}

// Offset returns the SQL OFFSET value.
func (p *PaginatedRequest) Offset() int {
	if p.Page <= 0 {
		p.Page = 1
	}
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	return (p.Page - 1) * p.PageSize
}

// Limit returns the SQL LIMIT value, capped at 100.
func (p *PaginatedRequest) Limit() int {
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	if p.PageSize > 100 {
		p.PageSize = 100
	}
	return p.PageSize
}

// RunListFilter holds filter parameters for listing pipeline runs.
type RunListFilter struct {
	PipelineID  string
	Status      string
	TriggerType string
	Limit       int
	Offset      int
}

// RunCompletionResult holds the result of checking run completion.
type RunCompletionResult struct {
	IsComplete bool `json:"is_complete"`
	AllSuccess bool `json:"all_success"`
}
