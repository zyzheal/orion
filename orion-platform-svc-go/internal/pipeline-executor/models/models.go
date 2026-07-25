// Package models defines the domain types for the pluggable Pipeline Executor.
//
// Architecture (chain-of-responsibility):
//   Pipeline — top-level container for an ordered chain of Steps.
//   Step     — a single processing unit (filter, transform, notify, action,
//              condition) that receives input and produces output.
//   Executor — runs steps in priority order, passing each step's output as the
//              next step's input; errors short-circuit the chain.
//
// Pipeline state machine: active | disabled
// Step status:            ready | error
// Execution status:       running | completed | failed
package models

import "time"

// ---------------------------------------------------------------------------
// Status constants
// ---------------------------------------------------------------------------

const (
	// Pipeline status
	PipelineStatusActive   = "active"
	PipelineStatusDisabled = "disabled"

	// PipelineStep status
	StepStatusReady = "ready"
	StepStatusError = "error"

	// PipelineExecution status
	ExecStatusRunning   = "running"
	ExecStatusCompleted = "completed"
	ExecStatusFailed    = "failed"

	// Step types
	StepTypeFilter    = "filter"
	StepTypeTransform = "transform"
	StepTypeNotify    = "notify"
	StepTypeAction    = "action"
	StepTypeCondition = "condition"

	// Pipeline categories
	CategoryAlert       = "alert"
	CategoryNotification = "notification"
	CategoryWebhook     = "webhook"
	CategoryAutomation  = "automation"
)

// ---------------------------------------------------------------------------
// Pipeline — the top-level container
// ---------------------------------------------------------------------------

type Pipeline struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenant_id" db:"tenant_id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	Category    string    `json:"category" db:"category"` // "alert", "notification", "webhook", "automation"
	Status      string    `json:"status" db:"status"`     // "active", "disabled"
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// ---------------------------------------------------------------------------
// PipelineStep — a single step in the chain
// ---------------------------------------------------------------------------

type PipelineStep struct {
	ID         string    `json:"id" db:"id"`
	TenantID   string    `json:"tenant_id" db:"tenant_id"`
	PipelineID string    `json:"pipeline_id" db:"pipeline_id"`
	Name       string    `json:"name" db:"name"`
	Type       string    `json:"type" db:"type"`    // "filter", "transform", "notify", "action", "condition"
	Config     string    `json:"config" db:"config"` // JSON
	Priority   int       `json:"priority" db:"priority"` // execution order
	Enabled    bool      `json:"enabled" db:"enabled"`
	Status     string    `json:"status" db:"status"` // "ready", "error"
	Error      string    `json:"error" db:"error"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time `json:"updated_at" db:"updated_at"`
}

// ---------------------------------------------------------------------------
// PipelineExecution — an execution attempt record
// ---------------------------------------------------------------------------

type PipelineExecution struct {
	ID          string     `json:"id" db:"id"`
	TenantID    string     `json:"tenant_id" db:"tenant_id"`
	PipelineID  string     `json:"pipeline_id" db:"pipeline_id"`
	Input       string     `json:"input" db:"input"` // JSON input data
	Output      string     `json:"output" db:"output"` // JSON output data
	Status      string     `json:"status" db:"status"` // "running", "completed", "failed"
	StepsRun    int        `json:"steps_run" db:"steps_run"`
	StepsFailed int        `json:"steps_failed" db:"steps_failed"`
	Error       string     `json:"error" db:"error"`
	StartedAt   time.Time  `json:"started_at" db:"started_at"`
	FinishedAt  *time.Time `json:"finished_at,omitempty" db:"finished_at"`
	DurationMs  int64      `json:"duration_ms" db:"duration_ms"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
}

// ---------------------------------------------------------------------------
// StepHandler — SPI that concrete step handlers implement
// ---------------------------------------------------------------------------

// StepHandler is the interface that concrete step processors implement.
type StepHandler interface {
	// Type returns the step type (e.g. "filter", "transform", "notify").
	Type() string
	// Name returns a human-readable name for this handler.
	Name() string
	// Process runs a single step. input is the upstream output (or the
	// original input for the first step). config holds JSON-unmarshalled
	// step configuration.
	Process(input []byte, config map[string]string) ([]byte, error)
}

// ---------------------------------------------------------------------------
// API request / response types
// ---------------------------------------------------------------------------

// CreatePipelineRequest is the payload for creating a new pipeline.
type CreatePipelineRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Category    string `json:"category" binding:"required"` // "alert", "notification", "webhook", "automation"
}

// AddStepRequest is the payload for adding a step to a pipeline.
type AddStepRequest struct {
	Name     string            `json:"name" binding:"required"`
	Type     string            `json:"type" binding:"required"`   // "filter", "transform", "notify", "action", "condition"
	Config   map[string]string `json:"config"`                    // JSON config
	Priority int               `json:"priority" binding:"required"` // execution order
}

// RunPipelineRequest is the payload for triggering an execution.
type RunPipelineRequest struct {
	Input map[string]interface{} `json:"input" binding:"required"`
}

// UpdatePipelineRequest is the payload for updating a pipeline.
type UpdatePipelineRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Category    *string `json:"category"`
	Status      *string `json:"status"`
}

// UpdateStepRequest is the payload for updating a step.
type UpdateStepRequest struct {
	Name     *string           `json:"name"`
	Type     *string           `json:"type"`
	Config   *map[string]string `json:"config"`
	Priority *int              `json:"priority"`
	Enabled  *bool             `json:"enabled"`
	Status   *string           `json:"status"`
	Error    *string           `json:"error"`
}

// PipelineListResponse wraps a paginated list of pipelines.
type PipelineListResponse struct {
	Total int64      `json:"total"`
	Data  []Pipeline `json:"data"`
}

// StepListResponse wraps a paginated list of steps.
type StepListResponse struct {
	Total int64        `json:"total"`
	Data  []PipelineStep `json:"data"`
}

// ExecutionListResponse wraps a paginated list of executions.
type ExecutionListResponse struct {
	Total int64               `json:"total"`
	Data  []PipelineExecution `json:"data"`
}
