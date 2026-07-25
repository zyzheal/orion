// Package engine provides the execution engine for Pipeline Executor.
//
// Architecture (three-tier):
//   Pipeline — top-level container for an ordered set of Stages.
//   Stage    — a parallelisable group of Tasks with dependency links.
//   Task     — a single processing unit with retry policy, timeout, and action.
//
// The Engine orchestrates stages via a StageScheduler (topological, parallel
// where dependencies allow) and delegates each task to a pluggable handler.
package engine

import (
	"context"
	"time"
)

// ---------------------------------------------------------------------------
// Status constants
// ---------------------------------------------------------------------------

// PipelineStatus represents the state of a Pipeline.
type PipelineStatus string

const (
	// Pipeline lifecycle statuses
	PipelineStatusDraft    PipelineStatus = "draft"
	PipelineStatusActive   PipelineStatus = "active"
	PipelineStatusDisabled PipelineStatus = "disabled"
	// Run statuses
	RunStatusPending   PipelineStatus = "pending"
	RunStatusRunning   PipelineStatus = "running"
	RunStatusCompleted PipelineStatus = "completed"
	RunStatusFailed    PipelineStatus = "failed"
	RunStatusCancelled PipelineStatus = "cancelled"
)

// StageStatus represents the state of a Stage within a run.
type StageStatus string

const (
	StageStatusPending  StageStatus = "pending"
	StageStatusRunning  StageStatus = "running"
	StageStatusSkipped  StageStatus = "skipped"
	StageStatusSuccess  StageStatus = "success"
	StageStatusFailed   StageStatus = "failed"
)

// TaskStatus represents the state of a Task.
type TaskStatus string

const (
	TaskStatusPending  TaskStatus = "pending"
	TaskStatusRunning  TaskStatus = "running"
	TaskStatusSuccess  TaskStatus = "success"
	TaskStatusFailed   TaskStatus = "failed"
	TaskStatusSkipped  TaskStatus = "skipped"
)

// ---------------------------------------------------------------------------
// Config — immutable execution configuration for a Pipeline
// ---------------------------------------------------------------------------

// Config holds execution-time knobs.
type Config struct {
	// MaxConcurrency limits the number of stages that can run in parallel.
	// 0 or 1 means sequential.
	MaxConcurrency int `json:"max_concurrency"`

	// DefaultTimeout is the per-stage timeout when a Stage does not specify one.
	DefaultTimeout time.Duration `json:"default_timeout"`

	// DefaultMaxRetries is the per-task retry count when a Task does not specify one.
	DefaultMaxRetries int `json:"default_max_retries"`

	// BackoffBase is the base delay for exponential retry backoff.
	// 0 means no backoff (immediate retry).
	BackoffBase time.Duration `json:"backoff_base"`

	// OnFailure controls what happens when a stage fails:
	//   "stop"     — abort the whole pipeline (default)
	//   "skip"     — mark downstream stages as skipped
	//   "continue" — attempt remaining stages regardless
	OnFailure FailureMode `json:"on_failure"`
}

// FailureMode dictates behaviour when a stage fails.
type FailureMode string

const (
	FailureModeStop     FailureMode = "stop"
	FailureModeSkip     FailureMode = "skip"
	FailureModeContinue FailureMode = "continue"
)

// ResolveTimeout returns the effective timeout for a task/stage, preferring the
// task-level value when non-zero, then falling back to Config defaults.
func (c *Config) ResolveTimeout(taskTimeout time.Duration) time.Duration {
	if taskTimeout > 0 {
		return taskTimeout
	}
	if c.DefaultTimeout > 0 {
		return c.DefaultTimeout
	}
	return 5 * time.Minute // safe default
}

// ResolveMaxRetries returns the effective max retries.
func (c *Config) ResolveMaxRetries(taskMaxRetries int) int {
	if taskMaxRetries >= 0 {
		return taskMaxRetries
	}
	if c.DefaultMaxRetries >= 0 {
		return c.DefaultMaxRetries
	}
	return 0
}

// ---------------------------------------------------------------------------
// Pipeline — top-level container
// ---------------------------------------------------------------------------

// Pipeline bundles stages and execution configuration.
type Pipeline struct {
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	TenantID  string          `json:"tenant_id"`
	Category  string          `json:"category"`
	Status    PipelineStatus  `json:"status"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
	Stages    []Stage         `json:"stages"`
	Config    Config          `json:"config"`
}

// HasStage reports whether a stage with the given name exists.
func (p *Pipeline) HasStage(name string) bool {
	for _, s := range p.Stages {
		if s.Name == name {
			return true
		}
	}
	return false
}

// ---------------------------------------------------------------------------
// Stage — a parallelisable group of Tasks with dependency links
// ---------------------------------------------------------------------------

// Stage groups tasks that execute together. Stages may declare dependencies on
// other stage names; the engine ensures a stage only runs once all its
// dependencies have completed successfully.
type Stage struct {
	Name string `json:"name"`

	// Tasks in this stage, executed sequentially in order.
	Tasks []Task `json:"tasks"`

	// DependsOn lists stage names that must complete before this one starts.
	DependsOn []string `json:"depends_on,omitempty"`

	// Timeout limits the total wall-clock time for this stage.
	// 0 means use Config.DefaultTimeout (or the hard-coded default).
	Timeout time.Duration `json:"timeout,omitempty"`

	// InputSchema / OutputSchema describe the shape of data flowing in/out
	// of this stage. Used for validation and documentation; not enforced
	// at runtime by the engine core.
	InputSchema  map[string]string `json:"input_schema,omitempty"`
	OutputSchema map[string]string `json:"output_schema,omitempty"`
}

// ---------------------------------------------------------------------------
// Task — a single processing unit
// ---------------------------------------------------------------------------

// TaskAction is the kind of work a Task performs.
type TaskAction string

const (
	TaskActionShell       TaskAction = "shell"
	TaskActionHTTP        TaskAction = "http"
	TaskActionDocker      TaskAction = "docker"
	TaskActionSubPipeline TaskAction = "sub_pipeline"
	TaskActionPlugin      TaskAction = "plugin"
	TaskActionNoop        TaskAction = "noop"
)

// Task is a single unit of work inside a Stage.
type Task struct {
	Name string `json:"name"`

	Action TaskAction `json:"action"`

	// Parameters are action-specific key-value arguments.
	Parameters map[string]interface{} `json:"parameters,omitempty"`

	// Retry policy
	MaxRetries int `json:"max_retries,omitempty"`

	// Timeout for this individual task (0 means use Config.DefaultTimeout).
	Timeout time.Duration `json:"timeout,omitempty"`

	// ContinueOnError — when true, a failed task does not fail the stage.
	ContinueOnError bool `json:"continue_on_error"`
}

// ---------------------------------------------------------------------------
// TaskHandler — SPI for pluggable task execution
// ---------------------------------------------------------------------------

// TaskHandler is the interface that concrete task processors implement.
type TaskHandler interface {
	Type() TaskAction
	Execute(ctx context.Context, params map[string]interface{}, output *TaskResult) error
}

// ---------------------------------------------------------------------------
// TaskResult — produced by TaskHandler.Execute
// ---------------------------------------------------------------------------

// TaskResult is the outcome of executing one Task.
type TaskResult struct {
	Outputs map[string]string `json:"outputs,omitempty"`
	Raw     string            `json:"raw,omitempty"`
	Success bool              `json:"success"`
}

// ---------------------------------------------------------------------------
// RunResult — top-level outcome of Execute
// ---------------------------------------------------------------------------

// RunResult aggregates stage-level results after Execute completes.
type RunResult struct {
	PipelineID string                `json:"pipeline_id"`
	TenantID   string                `json:"tenant_id"`
	RunID      string                `json:"run_id"`
	Status     PipelineStatus        `json:"status"`
	Stages     map[string]*StageState `json:"stages"`
	StartedAt  time.Time             `json:"started_at"`
	FinishedAt time.Time             `json:"finished_at"`
	DurationMs int64                 `json:"duration_ms"`
	Error      string                `json:"error,omitempty"`
}

// ---------------------------------------------------------------------------
// StageState — runtime snapshot of a single stage
// ---------------------------------------------------------------------------

// StageState tracks a stage's execution state within a run.
type StageState struct {
	Name       string          `json:"name"`
	Status     StageStatus     `json:"status"`
	Tasks      map[string]*TaskState
	StartedAt  time.Time       `json:"started_at,omitempty"`
	FinishedAt time.Time       `json:"finished_at,omitempty"`
	Error      string          `json:"error,omitempty"`
}

// ---------------------------------------------------------------------------
// TaskState — runtime snapshot of a single task
// ---------------------------------------------------------------------------

// TaskState tracks a task's execution state.
type TaskState struct {
	Name     string      `json:"name"`
	Action   TaskAction  `json:"action"`
	Status   TaskStatus  `json:"status"`
	Attempts int         `json:"attempts"`
	Output   *TaskResult `json:"output,omitempty"`
	Error    string      `json:"error,omitempty"`
}

// ---------------------------------------------------------------------------
// Rollback — recovery hook called on stage failure
// ---------------------------------------------------------------------------

// Rollback is an optional hook attached to a Pipeline. The engine calls it on
// each successfully-completed stage (in reverse order) when the pipeline
// ultimately fails. The compensator may undo side effects (e.g. delete a
// deployed artefact, close a ticket).
type Rollback func(ctx context.Context, stageName string, state *StageState) error

// EngineCallbacks are optional hooks for run-level observability.
type EngineCallbacks struct {
	OnRunStart  func(result *RunResult)
	OnRunEnd    func(result *RunResult)
	OnStageStart func(runID, stageName string)
	OnStageEnd   func(runID, stageName string, status StageStatus, err error)
	OnTaskStart  func(runID, stageName, taskName string)
	OnTaskEnd    func(runID, stageName, taskName string, status TaskStatus, err error)
}
