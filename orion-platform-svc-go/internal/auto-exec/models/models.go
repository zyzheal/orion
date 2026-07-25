// Package models defines the domain types for the auto-exec execution engine.
//
// Architecture inspired by NeatLogic's pattern:
//   - Executor: top-level orchestrator interface (Execute/Cancel/Status)
//   - ExecutorPlugin: SPI that plugins implement for specific execution types
//   - ExecutorFactory: registry that dispatches jobs to the right plugin
//
// Job state machine:
//   pending -> running -> completed | failed | cancelled | timeout
//
// Each Job carries tenant isolation, retry policy, timeout, and structured
// logging references so that execution results are fully auditable.
package models

import "time"

// JobStatus represents the lifecycle state of an execution job.
const (
	StatusPending   = "pending"
	StatusRunning   = "running"
	StatusCompleted = "completed"
	StatusFailed    = "failed"
	StatusCancelled = "cancelled"
	StatusTimeout   = "timeout"
)

// ---------------------------------------------------------------------------
// Job — the unit of execution
// ---------------------------------------------------------------------------

// Job represents a unit of work to be executed by a plugin.
type Job struct {
	ID            string                 `json:"id" db:"id"`
	TenantID      string                 `json:"tenant_id" db:"tenant_id"`
	Name          string                 `json:"name" db:"name"`
	Type          string                 `json:"type" db:"type"`        // e.g. "shell", "python", "http", "sql", "webhook"
	Description   string                 `json:"description" db:"description"`
	Params        map[string]interface{} `json:"params" db:"params"`    // plugin-specific parameters
	Inputs        map[string]interface{} `json:"inputs" db:"inputs"`    // runtime inputs
	Status        string                 `json:"status" db:"status"`
	TimeoutSec    int                    `json:"timeout_sec" db:"timeout_sec"`
	RetryCount    int                    `json:"retry_count" db:"retry_count"`
	RetryInterval int                    `json:"retry_interval_sec" db:"retry_interval_sec"`
	Result        *Result                `json:"result,omitempty" db:"-"`
	CreatedAt     time.Time              `json:"created_at" db:"created_at"`
	StartedAt     *time.Time             `json:"started_at,omitempty" db:"started_at"`
	FinishedAt    *time.Time             `json:"finished_at,omitempty" db:"finished_at"`
}

// ---------------------------------------------------------------------------
// Result — the output of a job execution
// ---------------------------------------------------------------------------

// Result captures the outcome of a single execution attempt.
type Result struct {
	JobID       string                 `json:"job_id" db:"job_id"`
	ExitCode    int                    `json:"exit_code" db:"exit_code"`
	Stdout      string                 `json:"stdout" db:"stdout"`
	Stderr      string                 `json:"stderr" db:"stderr"`
	Output       map[string]interface{} `json:"output" db:"output"`
	OutputData  map[string]interface{} `json:"output_data" db:"output_data"`
	ErrorMessage string                `json:"error_message" db:"error_message"`
	DurationMs  int64                  `json:"duration_ms" db:"duration_ms"`
}

// ---------------------------------------------------------------------------
// API request / response types
// ---------------------------------------------------------------------------

// CreateJobRequest is the payload for creating a new job.
type CreateJobRequest struct {
	Name          string                 `json:"name" binding:"required"`
	Type          string                 `json:"type" binding:"required"`
	Description   string                 `json:"description"`
	Params        map[string]interface{} `json:"params"`
	Inputs        map[string]interface{} `json:"inputs"`
	TimeoutSec    int                    `json:"timeout_sec"`
	RetryCount    int                    `json:"retry_count"`
	RetryInterval int                    `json:"retry_interval_sec"`
}

// JobResponse wraps query results with pagination info.
type JobResponse struct {
	Total int64 `json:"total"`
	Data  []Job `json:"data"`
}

// ExecuteJobRequest carries runtime inputs for an execution.
type ExecuteJobRequest struct {
	Inputs map[string]interface{} `json:"inputs"`
}

// PluginMetadata is returned by ListPlugins to describe available executors.
type PluginMetadata struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	TimeoutSec  int    `json:"default_timeout_sec"`
}

// ---------------------------------------------------------------------------
// ExecutionTask — the unit of scheduled execution (execution_tasks table)
// ---------------------------------------------------------------------------

// ExecutionTask represents a scheduled task executed via a plugin.
type ExecutionTask struct {
	ID           string     `json:"id" db:"id"`
	TenantID     string     `json:"tenant_id" db:"tenant_id"`
	Name         string     `json:"name" db:"name"`
	Type         string     `json:"type" db:"type"`
	Plugin       string     `json:"plugin" db:"plugin"`
	PluginParams string     `json:"plugin_params" db:"plugin_params"`
	Status       string     `json:"status" db:"status"`
	RetryCount   int        `json:"retry_count" db:"retry_count"`
	MaxRetries   int        `json:"max_retries" db:"max_retries"`
	Timeout      int        `json:"timeout" db:"timeout"`
	Output       string     `json:"output" db:"output"`
	Error        string     `json:"error" db:"error"`
	CreatedAt    time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at" db:"updated_at"`
	StartedAt    *time.Time `json:"started_at,omitempty" db:"started_at"`
	FinishedAt   *time.Time `json:"finished_at,omitempty" db:"finished_at"`
}

// ---------------------------------------------------------------------------
// Request / response types
// ---------------------------------------------------------------------------


// RunTaskRequest carries optional runtime parameter overrides for task execution.
type RunTaskRequest struct {
	Params map[string]string `json:"params"`
}

// CreateTaskRequest is the payload for creating a new execution task.
type CreateTaskRequest struct {
	Name         string            `json:"name" binding:"required"`
	Type         string            `json:"type" binding:"required"`
	Plugin       string            `json:"plugin" binding:"required"`
	PluginParams map[string]string `json:"plugin_params"`
	MaxRetries   int               `json:"max_retries"`
	Timeout      int               `json:"timeout"`
}

// TaskListResponse wraps task query results with pagination info.
type TaskListResponse struct {
	Total int64             `json:"total"`
	Data  []ExecutionTask   `json:"data"`
}

// ---------------------------------------------------------------------------
// ExecutionHistory — audit trail for task execution (execution_history table)
// ---------------------------------------------------------------------------

// ExecutionHistory records a single execution event for a task.
type ExecutionHistory struct {
	ID         string     `json:"id" db:"id"`
	TaskID     string     `json:"task_id" db:"task_id"`
	Action     string     `json:"action" db:"action"`
	Result     string     `json:"result" db:"result"`
	StartedAt  time.Time  `json:"started_at" db:"started_at"`
	FinishedAt time.Time  `json:"finished_at" db:"finished_at"`
	DurationMs int64      `json:"duration_ms" db:"duration_ms"`
}

// HistoryListResponse wraps history query results with pagination info.
type HistoryListResponse struct {
	Total int64              `json:"total"`
	Data  []ExecutionHistory `json:"data"`
}

// ---------------------------------------------------------------------------
// PluginSPI — plugin registry entry (plugin_spi table)
// ---------------------------------------------------------------------------

// PluginSPI represents a registered plugin in the execution engine.
type PluginSPI struct {
	ID          string                 `json:"id" db:"id"`
	TenantID    string                 `json:"tenant_id" db:"tenant_id"`
	Name        string                 `json:"name" db:"name"`
	Category    string                 `json:"category" db:"category"`
	Description string                 `json:"description" db:"description"`
	Params      map[string]string      `json:"params" db:"params"`
	Enabled     bool                   `json:"enabled" db:"enabled"`
	CreatedAt   time.Time              `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at" db:"updated_at"`
}

// RegisterPluginRequest is the payload for registering a new plugin.
type RegisterPluginRequest struct {
	Name        string                `json:"name" binding:"required"`
	Category    string                `json:"category" binding:"required"`
	Description string                `json:"description"`
	Params      map[string]string     `json:"params"`
	Enabled     *bool                 `json:"enabled"`
}

// PluginListResponse wraps plugin query results with pagination info.
type PluginListResponse struct {
	Total int64         `json:"total"`
	Data  []PluginSPI   `json:"data"`
}
