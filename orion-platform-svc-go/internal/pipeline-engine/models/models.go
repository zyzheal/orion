package models

import (
	"encoding/json"
)

// PipelineRunStatus represents the status of a pipeline run.
type PipelineRunStatus string

const (
	RunStatusPending   PipelineRunStatus = "PENDING"
	RunStatusRunning   PipelineRunStatus = "RUNNING"
	RunStatusSuccess   PipelineRunStatus = "SUCCESS"
	RunStatusFailed    PipelineRunStatus = "FAILED"
	RunStatusCancelled PipelineRunStatus = "CANCELLED"
)

// TaskStatus represents the status of a task.
type TaskStatus string

const (
	TaskStatusPending  TaskStatus = "PENDING"
	TaskStatusRunning  TaskStatus = "RUNNING"
	TaskStatusSuccess  TaskStatus = "SUCCESS"
	TaskStatusFailed   TaskStatus = "FAILED"
	TaskStatusSkipped  TaskStatus = "SKIPPED"
)

// TriggerType represents the trigger type for a pipeline run.
type TriggerType string

const (
	TriggerGit     TriggerType = "git"
	TriggerAPI     TriggerType = "api"
	TriggerEvent   TriggerType = "event"
	TriggerSchedule TriggerType = "schedule"
	TriggerManual  TriggerType = "manual"
)

// --- Core entities ---

// PipelineRun represents a single execution instance of a pipeline.
type PipelineRun struct {
	ID             string            `json:"id" db:"id"`
	PipelineID     string            `json:"pipeline_id" db:"pipeline_id"`
	PipelineVersion string           `json:"pipeline_version" db:"pipeline_version"`
	TriggerType    TriggerType       `json:"trigger_type" db:"trigger_type"`
	TriggerBy      *string           `json:"trigger_by,omitempty" db:"trigger_by"`
	Status         PipelineRunStatus `json:"status" db:"status"`
	Environment    *string           `json:"environment,omitempty" db:"environment"`
	StartedAt      *int64            `json:"started_at,omitempty" db:"started_at"`   // timestamp
	CompletedAt    *int64            `json:"completed_at,omitempty" db:"completed_at"` // timestamp
	DurationMs     *int64            `json:"duration_ms,omitempty" db:"duration_ms"`
	Context        string            `json:"context" db:"context"` // JSON
	TenantID       string            `json:"tenant_id" db:"tenant_id"`
	CreatedAt      int64             `json:"created_at" db:"created_at"`
	UpdatedAt      int64             `json:"updated_at" db:"updated_at"`
}

// ContextMap returns the run context as a map.
func (r *PipelineRun) ContextMap() map[string]interface{} {
	if r.Context == "" {
		return make(map[string]interface{})
	}
	var m map[string]interface{}
	_ = json.Unmarshal([]byte(r.Context), &m)
	return m
}

// Stage represents an execution stage within a pipeline run.
type Stage struct {
	ID            string     `json:"id" db:"id"`
	RunID         string     `json:"run_id" db:"run_id"`
	Name          string     `json:"name" db:"name"`
	Sequence      int        `json:"sequence" db:"sequence"`
	Status        TaskStatus `json:"status" db:"status"` // reuse TaskStatus for stage status
	DependsOn     string    `json:"depends_on" db:"depends_on"` // JSON array
	Condition     *string   `json:"condition,omitempty" db:"condition"`
	TimeoutSeconds int       `json:"timeout_seconds" db:"timeout_seconds"`
	RetryCount    int        `json:"retry_count" db:"retry_count"`
	MaxRetries    int        `json:"max_retries" db:"max_retries"`
	StartedAt     *int64     `json:"started_at,omitempty" db:"started_at"`
	CompletedAt   *int64     `json:"completed_at,omitempty" db:"completed_at"`
	DurationMs    *int64     `json:"duration_ms,omitempty" db:"duration_ms"`
	Result        *string    `json:"result,omitempty" db:"result"` // JSON
	Error         *string    `json:"error,omitempty" db:"error"`
	Targets       string    `json:"targets" db:"targets"` // JSON array
	ExecutionMode *string    `json:"execution_mode,omitempty" db:"execution_mode"`
	BatchSize     int        `json:"batch_size" db:"batch_size"`
	TenantID      string     `json:"tenant_id" db:"tenant_id"`
	CreatedAt     int64      `json:"created_at" db:"created_at"`
	UpdatedAt     int64      `json:"updated_at" db:"updated_at"`
}

// Task represents a single task within a stage.
type Task struct {
	ID             string     `json:"id" db:"id"`
	StageID        string     `json:"stage_id" db:"stage_id"`
	Name           string     `json:"name" db:"name"`
	Type           string     `json:"type" db:"type"`
	Sequence       int        `json:"sequence" db:"sequence"`
	Status         TaskStatus `json:"status" db:"status"`
	Config         string     `json:"config" db:"config"`          // JSON
	Parameters     string     `json:"parameters" db:"parameters"`  // JSON
	ResourceQuota  *string    `json:"resource_quota,omitempty" db:"resource_quota"` // JSON
	RetryCount     int        `json:"retry_count" db:"retry_count"`
	MaxRetries     int        `json:"max_retries" db:"max_retries"`
	TimeoutSeconds int        `json:"timeout_seconds" db:"timeout_seconds"`
	StartedAt      *int64     `json:"started_at,omitempty" db:"started_at"`
	CompletedAt    *int64     `json:"completed_at,omitempty" db:"completed_at"`
	DurationMs     *int64     `json:"duration_ms,omitempty" db:"duration_ms"`
	Result         *string    `json:"result,omitempty" db:"result"` // JSON
	Log            *string    `json:"log,omitempty" db:"log"`
	Error          *string    `json:"error,omitempty" db:"error"`
	TenantID       string     `json:"tenant_id" db:"tenant_id"`
	CreatedAt      int64      `json:"created_at" db:"created_at"`
	UpdatedAt      int64      `json:"updated_at" db:"updated_at"`
}

// Checkpoint represents a crash-recovery checkpoint.
type Checkpoint struct {
	ID        string    `json:"id" db:"id"`
	RunID     string    `json:"run_id" db:"run_id"`
	StageName string    `json:"stage_name" db:"stage_name"`
	TaskName  *string   `json:"task_name,omitempty" db:"task_name"`
	State     string    `json:"state" db:"state"` // JSON
	CreatedAt int64     `json:"created_at" db:"created_at"`
}

// --- YAML parsing models ---

// PipelineSpec represents the parsed YAML pipeline definition.
type PipelineSpec struct {
	Name      string        `yaml:"name"`
	Version   string        `yaml:"version"`
	Stages    []StageSpec   `yaml:"stages"`
	Variables map[string]string `yaml:"variables,omitempty"`
}

// StageSpec represents a stage in the YAML pipeline spec.
type StageSpec struct {
	Name           string   `yaml:"name"`
	DependsOn      []string `yaml:"depends_on,omitempty"`
	Condition      *string  `yaml:"condition,omitempty"`
	TimeoutSeconds int      `yaml:"timeout_seconds,omitempty"`
	MaxRetries     int      `yaml:"max_retries,omitempty"`
	Tasks          []TaskSpec `yaml:"tasks"`
}

// TaskSpec represents a task in the YAML stage spec.
type TaskSpec struct {
	Name           string                 `yaml:"name"`
	Type           string                 `yaml:"type"`
	TimeoutSeconds int                    `yaml:"timeout_seconds,omitempty"`
	MaxRetries     int                    `yaml:"max_retries,omitempty"`
	Config         map[string]interface{} `yaml:"config,omitempty"`
	Parameters     map[string]interface{} `yaml:"parameters,omitempty"`
}

// --- Request / Response models ---

// TriggerRequest is the request body for triggering a pipeline run.
type TriggerRequest struct {
	PipelineID    string `json:"pipeline_id" binding:"required"`
	PipelineVersion string `json:"pipeline_version" binding:"required"`
	TriggerType   string `json:"trigger_type"`
	TriggerBy     string `json:"trigger_by"`
	Environment   string `json:"environment"`
	Context       map[string]interface{} `json:"context,omitempty"`
	// Optional: inline YAML spec. If omitted, engine fetches from spec store.
	SpecYAML *string `json:"spec_yaml,omitempty"`
}

// ListRunsQuery is the query params for listing runs.
type ListRunsQuery struct {
	Status    string `json:"status" form:"status"`
	Limit     int    `json:"limit" form:"limit"`
	Offset    int    `json:"offset" form:"offset"`
}

// CancelRunRequest is the request body for cancelling a run.
type CancelRunRequest struct {
	TriggerBy string `json:"trigger_by"`
}

// RunListResponse wraps a paginated run list.
type RunListResponse struct {
	Runs  []PipelineRun `json:"runs"`
	Total int           `json:"total"`
}

// EngineState represents a checkpointed engine state for crash recovery.
type EngineState struct {
	CompletedStages []string              `json:"completed_stages"`
	FailedStages    []string              `json:"failed_stages"`
	TaskOutputs     map[string]map[string]string `json:"task_outputs"`
}
