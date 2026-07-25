package models

import "time"

// ProcessStep represents a process-step record.
type ProcessStep struct {
	ID         string    `json:"id" db:"id"`
	TenantID   string    `json:"tenant_id" db:"tenant_id"`
	Name       string    `json:"name" db:"name"`
	Value      string    `json:"value" db:"value"`
	Enabled    bool      `json:"enabled" db:"enabled"`
	Order      int       `json:"order" db:"order"`
	StepType   string    `json:"step_type" db:"step_type"`
	Assignee   string    `json:"assignee" db:"assignee"`
	Timeout    int       `json:"timeout" db:"timeout"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time `json:"updated_at" db:"updated_at"`
}

type CreateProcessStepRequest struct {
	Name    string `json:"name" binding:"required"`
	Value   string `json:"value"`
	Enabled bool   `json:"enabled"`
}

type UpdateProcessStepRequest struct {
	Name    *string `json:"name"`
	Value   *string `json:"value"`
	Enabled *bool   `json:"enabled"`
}

// ---------------------------------------------------------------------------
// Step type constants
// ---------------------------------------------------------------------------

const (
	StepTypeApproval     = "approval"
	StepTypeNotification = "notification"
	StepTypeAutomation   = "automation"
	StepTypeCondition    = "condition"
	StepTypeParallel     = "parallel"
	StepTypeTimer        = "timer"
	StepTypeIntegration  = "integration"
	StepTypeExecution    = "execution"
	StepTypeDecision     = "decision"
	StepTypeDelay        = "delay"
	StepTypeMerge        = "merge"
	StepTypeCustom       = "custom"
)

// ---------------------------------------------------------------------------
// Status constants
// ---------------------------------------------------------------------------

const (
	ExecStatusPending   = "pending"
	ExecStatusRunning   = "running"
	ExecStatusCompleted = "completed"
	ExecStatusFailed    = "failed"
)

const (
	StepStatusReady     = "ready"
	StepStatusRunning   = "running"
	StepStatusCompleted = "completed"
	StepStatusFailed    = "failed"
)

// ---------------------------------------------------------------------------
// Event type constants
// ---------------------------------------------------------------------------

const (
	EventTypeStart     = "start"
	EventTypeEnd       = "end"
	EventTypeApprove   = "approve"
	EventTypeReject    = "reject"
	EventTypeDelegate  = "delegate"
	EventTypeEscalate  = "escalate"
	EventTypeSkip      = "skip"
)

// ---------------------------------------------------------------------------
// ProcessStepEvent — a lifecycle event for a step
// ---------------------------------------------------------------------------

type ProcessStepEvent struct {
	ID        string    `json:"id" db:"id"`
	StepID    string    `json:"step_id" db:"step_id"`
	EventType string    `json:"event_type" db:"event_type"`
	Details   string    `json:"details" db:"details"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// ---------------------------------------------------------------------------
// ProcessStepExecution — a recorded execution of a step
// ---------------------------------------------------------------------------

type ProcessStepExecution struct {
	ID         string    `json:"id" db:"id"`
	StepID     string    `json:"step_id" db:"step_id"`
	InstanceID string    `json:"instance_id" db:"instance_id"`
	Input      string    `json:"input" db:"input"`
	Status     string    `json:"status" db:"status"`
	Output     string    `json:"output" db:"output"`
	Error      string    `json:"error" db:"error"`
	DurationMs int64     `json:"duration_ms" db:"duration_ms"`
	StartedAt  time.Time `json:"started_at" db:"started_at"`
	FinishedAt *time.Time `json:"finished_at" db:"finished_at"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
}
