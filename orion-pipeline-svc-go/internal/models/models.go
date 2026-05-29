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
	Status      PipelineRunStatus
	TriggerType TriggerType
	Limit       int
	Offset      int
}
