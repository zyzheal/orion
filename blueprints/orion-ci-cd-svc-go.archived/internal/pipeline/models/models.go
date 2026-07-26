package models

import "time"

// TriggerType defines how a pipeline run was triggered.
type TriggerType string

const (
	TriggerManual   TriggerType = "manual"
	TriggerSchedule TriggerType = "schedule"
	TriggerWebhook  TriggerType = "webhook"
	TriggerEvent    TriggerType = "event"
	TriggerAPI      TriggerType = "api"
)

// PipelineRunStatus represents the lifecycle of a pipeline run.
type PipelineRunStatus string

const (
	StatusPending   PipelineRunStatus = "pending"
	StatusRunning   PipelineRunStatus = "running"
	StatusSuccess   PipelineRunStatus = "success"
	StatusFailed    PipelineRunStatus = "failed"
	StatusCancelled PipelineRunStatus = "cancelled"
	StatusTimeout   PipelineRunStatus = "timeout"
	StatusPaused    PipelineRunStatus = "paused"
)

// StageStatus represents the lifecycle of a stage.
type StageStatus string

const (
	StagePending StageStatus = "pending"
	StageRunning StageStatus = "running"
	StageSuccess StageStatus = "success"
	StageFailed  StageStatus = "failed"
	StageSkipped StageStatus = "skipped"
)

// TaskStatus represents the lifecycle of a task.
type TaskStatus string

const (
	TaskPending TaskStatus = "pending"
	TaskRunning TaskStatus = "running"
	TaskSuccess TaskStatus = "success"
	TaskFailed  TaskStatus = "failed"
	TaskSkipped TaskStatus = "skipped"
)

type Pipeline struct {
	ID             string    `db:"id" json:"id"`
	TenantID       string    `db:"tenant_id" json:"tenant_id"`
	Name           string    `db:"name" json:"name"`
	Description    string    `db:"description" json:"description"`
	RepoID         *string   `db:"repo_id" json:"repo_id,omitempty"`
	Branch         string    `db:"branch" json:"branch"`
	Version        string    `db:"version" json:"version"`
	TriggerType    string    `db:"trigger_type" json:"trigger_type"`
	CronExpression *string   `db:"cron_expression" json:"cron_expression,omitempty"`
	Config         string    `db:"config" json:"config"`
	YAMLConfig     string    `db:"yaml_config" json:"yaml_config"`
	Status         string    `db:"status" json:"status"`
	CreatedBy      string    `db:"created_by" json:"created_by"`
	CreatedAt      time.Time `db:"created_at" json:"created_at"`
	UpdatedAt      time.Time `db:"updated_at" json:"updated_at"`
	DeletedAt      *time.Time `db:"deleted_at" json:"-"`
}

type PipelineRun struct {
	ID              string            `db:"id" json:"id"`
	PipelineID      string            `db:"pipeline_id" json:"pipeline_id"`
	TenantID        string            `db:"tenant_id" json:"tenant_id"`
	PipelineVersion string            `db:"pipeline_version" json:"pipeline_version"`
	TriggerType     TriggerType       `db:"trigger_type" json:"trigger_type"`
	TriggerBy       string            `db:"trigger_by" json:"trigger_by"`
	Environment     string            `db:"environment" json:"environment"`
	Status          PipelineRunStatus `db:"status" json:"status"`
	StartedAt       *time.Time        `db:"started_at" json:"started_at,omitempty"`
	CompletedAt     *time.Time        `db:"completed_at" json:"completed_at,omitempty"`
	DurationMs      int64             `db:"duration_ms" json:"duration_ms"`
	Context         string            `db:"context" json:"context"`
	CreatedAt       time.Time         `db:"created_at" json:"created_at"`
	UpdatedAt       time.Time         `db:"updated_at" json:"updated_at"`
}

// Stage represents a stage within a pipeline run.
type Stage struct {
	ID             string      `db:"id" json:"id"`
	RunID          string      `db:"run_id" json:"run_id"`
	Name           string      `db:"name" json:"name"`
	Sequence       int         `db:"sequence" json:"sequence"`
	Status         StageStatus `db:"status" json:"status"`
	DependsOn      string      `db:"depends_on" json:"depends_on"`
	TimeoutSeconds int         `db:"timeout_seconds" json:"timeout_seconds"`
	RetryCount     int         `db:"retry_count" json:"retry_count"`
	MaxRetries     int         `db:"max_retries" json:"max_retries"`
	Logs           *string     `db:"logs" json:"logs,omitempty"`
	StartedAt      *time.Time  `db:"started_at" json:"started_at,omitempty"`
	CompletedAt    *time.Time  `db:"completed_at" json:"completed_at,omitempty"`
	CreatedAt      time.Time   `db:"created_at" json:"created_at"`
}

// Task represents a task within a stage.
type Task struct {
	ID          string     `db:"id" json:"id"`
	StageID     string     `db:"stage_id" json:"stage_id"`
	Name        string     `db:"name" json:"name"`
	Type        string     `db:"type" json:"type"`
	Status      TaskStatus `db:"status" json:"status"`
	Config      string     `db:"config" json:"config"`
	Sequence    int        `db:"sequence" json:"sequence"`
	StartedAt   *time.Time `db:"started_at" json:"started_at,omitempty"`
	CompletedAt *time.Time `db:"completed_at" json:"completed_at,omitempty"`
	ExitCode    int        `db:"exit_code" json:"exit_code"`
	Logs        string     `db:"logs" json:"logs"`
	CreatedAt   time.Time  `db:"created_at" json:"created_at"`
}

// PipelineStage is the legacy alias for Stage.
type PipelineStage = Stage

// PaginatedRequest provides pagination parameters.
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

// CreatePipelineRequest is the input for creating a pipeline.
type CreatePipelineRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Config      string `json:"config" binding:"required"`
}

// RunPipelineRequest is the input for starting a pipeline run.
type RunPipelineRequest struct {
	TriggerType TriggerType       `json:"trigger_type"`
	Environment string            `json:"environment"`
	Context     map[string]string `json:"context"`
}

// PipelineRunFilter filters pipeline runs.
type PipelineRunFilter struct {
	PipelineID  string
	TenantID    string
	Status      PipelineRunStatus
	TriggerType TriggerType
	Limit       int
	Offset      int
}

// PipelineStats holds aggregate statistics for a pipeline.
type PipelineStats struct {
	TotalRuns   int     `db:"total_runs" json:"total_runs"`
	SuccessRuns int     `db:"success_runs" json:"success_runs"`
	FailedRuns  int     `db:"failed_runs" json:"failed_runs"`
	RunningRuns int     `db:"running_runs" json:"running_runs"`
	AvgDuration float64 `db:"avg_duration" json:"avg_duration"`
}

// RunLogEntry represents a single log line from a pipeline run.
type RunLogEntry struct {
	StageName   string     `json:"stage_name"`
	Logs        *string    `json:"logs,omitempty"`
	Status      string     `json:"status"`
	StartedAt   *time.Time `json:"started_at,omitempty"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
}

// RunListResponse wraps a paginated list of runs.
type RunListResponse struct {
	Data  []PipelineRun `json:"data"`
	Total int           `json:"total"`
}

// ==================== Phase Group & Batch Models ====================

// PhaseGroup represents a group of pipeline phases for batch execution.
type PhaseGroup struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	Name        string    `db:"name" json:"name"`
	Description string    `db:"description" json:"description"`
	PipelineIDs string    `db:"pipeline_ids" json:"pipeline_ids"`
	Config      string    `db:"config" json:"config"`
	Status      string    `db:"status" json:"status"`
	CreatedBy   string    `db:"created_by" json:"created_by"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

// PhaseGroupRun records a single execution of a phase group.
type PhaseGroupRun struct {
	ID           string     `db:"id" json:"id"`
	PhaseGroupID string     `db:"phase_group_id" json:"phase_group_id"`
	TenantID     string     `db:"tenant_id" json:"tenant_id"`
	PipelineIDs  string     `db:"pipeline_ids" json:"pipeline_ids"`
	Status       string     `db:"status" json:"status"`
	StartedAt    *time.Time `db:"started_at" json:"started_at,omitempty"`
	CompletedAt  *time.Time `db:"completed_at" json:"completed_at,omitempty"`
	DurationMs   int64      `db:"duration_ms" json:"duration_ms"`
	CreatedAt    time.Time  `db:"created_at" json:"created_at"`
}

// BatchRun represents a one-time batch execution of pipelines.
type BatchRun struct {
	ID          string     `db:"id" json:"id"`
	TenantID    string     `db:"tenant_id" json:"tenant_id"`
	PipelineIDs string     `db:"pipeline_ids" json:"pipeline_ids"`
	Count       int        `db:"count" json:"count"`
	Status      string     `db:"status" json:"status"`
	StartedAt   *time.Time `db:"started_at" json:"started_at,omitempty"`
	CompletedAt *time.Time `db:"completed_at" json:"completed_at,omitempty"`
	DurationMs  int64      `db:"duration_ms" json:"duration_ms"`
	CreatedAt   time.Time  `db:"created_at" json:"created_at"`
}

// CreatePhaseGroupRequest is the input for creating a phase group.
type CreatePhaseGroupRequest struct {
	Name        string   `json:"name" binding:"required"`
	Description string   `json:"description"`
	PipelineIDs []string `json:"pipeline_ids" binding:"required"`
	Config      string   `json:"config"`
}

// UpdatePhaseGroupRequest is the input for updating a phase group.
type UpdatePhaseGroupRequest struct {
	Name        *string  `json:"name"`
	Description *string  `json:"description"`
	PipelineIDs []string `json:"pipeline_ids"`
	Config      *string  `json:"config"`
}

// CreateBatchRunRequest is the input for creating a batch run.
type CreateBatchRunRequest struct {
	PipelineIDs []string `json:"pipeline_ids" binding:"required"`
}

// ==================== Autonomous Pipeline Models ====================

// ErrorClassificationRule defines a rule for classifying pipeline errors.
type ErrorClassificationRule struct {
	ID         string    `db:"id" json:"id"`
	TenantID   string    `db:"tenant_id" json:"tenant_id"`
	PipelineID string    `db:"pipeline_id" json:"pipeline_id"`
	Name       string    `db:"name" json:"name"`
	Pattern    string    `db:"pattern" json:"pattern"`
	Category   string    `db:"category" json:"category"`
	Action     string    `db:"action" json:"action"`
	Priority   int       `db:"priority" json:"priority"`
	Enabled    bool      `db:"enabled" json:"enabled"`
	CreatedBy  string    `db:"created_by" json:"created_by"`
	CreatedAt  time.Time `db:"created_at" json:"created_at"`
	UpdatedAt  time.Time `db:"updated_at" json:"updated_at"`
}

// AdaptiveTimeoutConfig defines adaptive timeout configuration.
type AdaptiveTimeoutConfig struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	PipelineID  string    `db:"pipeline_id" json:"pipeline_id"`
	MinTimeout  int       `db:"min_timeout" json:"min_timeout"`
	MaxTimeout  int       `db:"max_timeout" json:"max_timeout"`
	Strategy    string    `db:"strategy" json:"strategy"`
	Multiplier  float64   `db:"multiplier" json:"multiplier"`
	Enabled     bool      `db:"enabled" json:"enabled"`
	CreatedBy   string    `db:"created_by" json:"created_by"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

// AutoRetryStrategy defines automatic retry configuration.
type AutoRetryStrategy struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	PipelineID  string    `db:"pipeline_id" json:"pipeline_id"`
	MaxRetries  int       `db:"max_retries" json:"max_retries"`
	Backoff     string    `db:"backoff" json:"backoff"`
	Conditions  string    `db:"conditions" json:"conditions"`
	Enabled     bool      `db:"enabled" json:"enabled"`
	CreatedBy   string    `db:"created_by" json:"created_by"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

// SelfHealingRequest is the input for triggering self-healing.
type SelfHealingRequest struct {
	RunID      string `json:"run_id" binding:"required"`
	PipelineID string `json:"pipeline_id" binding:"required"`
	Action     string `json:"action" binding:"required"`
	Reason     string `json:"reason"`
	StageName  string `json:"stage_name"`
}

// SelfHealingStatus represents the result of a self-healing operation.
type SelfHealingStatus struct {
	ID         string     `db:"id" json:"id"`
	TenantID   string     `db:"tenant_id" json:"tenant_id"`
	RunID      string     `db:"run_id" json:"run_id"`
	PipelineID string     `db:"pipeline_id" json:"pipeline_id"`
	Action     string     `db:"action" json:"action"`
	Status     string     `db:"status" json:"status"`
	Message    string     `db:"message" json:"message"`
	StageName  string     `db:"stage_name" json:"stage_name"`
	CreatedBy  string     `db:"created_by" json:"created_by"`
	CreatedAt  time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt  time.Time  `db:"updated_at" json:"updated_at"`
	CompletedAt *time.Time `db:"completed_at" json:"completed_at,omitempty"`
}

// Checkpoint represents a pipeline execution checkpoint.
type Checkpoint struct {
	ID        string    `db:"id" json:"id"`
	RunID     string    `db:"run_id" json:"run_id"`
	StageID   string    `db:"stage_id" json:"stage_id"`
	Name      string    `db:"name" json:"name"`
	Data      string    `db:"data" json:"data"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

// ControlLog records an execution control action.
type ControlLog struct {
	ID        string    `db:"id" json:"id"`
	RunID     string    `db:"run_id" json:"run_id"`
	Action    string    `db:"action" json:"action"`
	UserID    string    `db:"user_id" json:"user_id"`
	Message   string    `db:"message" json:"message"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}
