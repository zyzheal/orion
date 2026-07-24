package models

import "time"

// --- Enums ---

// TriggerType specifies how a deployment trigger is fired.
type TriggerType string

const (
	TriggerTypeCron       TriggerType = "cron"
	TriggerTypeTagPush    TriggerType = "tag_push"
	TriggerTypeBranchPush TriggerType = "branch_push"
	TriggerTypeManual     TriggerType = "manual"
	TriggerTypeAPI        TriggerType = "api"
	TriggerTypeScheduled  TriggerType = "scheduled"
)

// TriggerStatus specifies the current state of a deployment trigger.
type TriggerStatus string

const (
	TriggerStatusActive    TriggerStatus = "ACTIVE"
	TriggerStatusPending   TriggerStatus = "PENDING"
	TriggerStatusTriggered TriggerStatus = "TRIGGERED"
	TriggerStatusFailed    TriggerStatus = "FAILED"
)

// ExecutionStatus specifies the outcome of a trigger execution.
type ExecutionStatus string

const (
	ExecutionStatusRunning ExecutionStatus = "running"
	ExecutionStatusSuccess ExecutionStatus = "success"
	ExecutionStatusFailed  ExecutionStatus = "failed"
)

// Validate reports whether the trigger type is known.
func (t TriggerType) Validate() error {
	switch t {
	case TriggerTypeCron, TriggerTypeTagPush, TriggerTypeBranchPush,
		TriggerTypeManual, TriggerTypeAPI, TriggerTypeScheduled:
		return nil
	default:
		return nil // unknown type is accepted for forward compatibility
	}
}

// IsTimeBased returns true for cron/scheduled triggers.
func (t TriggerType) IsTimeBased() bool {
	return t == TriggerTypeCron || t == TriggerTypeScheduled
}

// --- Core entity ---

// DeploymentTrigger is a rule that fires a pipeline run.
type DeploymentTrigger struct {
	ID              string        `db:"id" json:"id"`
	TenantID        string        `db:"tenant_id" json:"tenantId"`
	Name            string        `db:"name" json:"name"`
	TriggerType     TriggerType   `db:"trigger_type" json:"triggerType"`
	Expression      string        `db:"expression" json:"expression"`      // cron schedule or tag/branch pattern
	TargetPipeline  string        `db:"target_pipeline" json:"targetPipeline"`
	Status          TriggerStatus `db:"status" json:"status"`
	LastTriggeredAt *time.Time    `db:"last_triggered_at" json:"lastTriggeredAt"`
	LastTriggerID   string        `db:"last_trigger_id" json:"lastTriggerId"`
	Enabled         bool          `db:"enabled" json:"enabled"`
	CreatedAt       time.Time     `db:"created_at" json:"createdAt"`
	UpdatedAt       time.Time     `db:"updated_at" json:"updatedAt"`
}

// --- Execution tracking ---

// TriggerExecution records one attempt to fire a trigger.
type TriggerExecution struct {
	ID            string          `db:"id" json:"id"`
	TriggerID     string          `db:"trigger_id" json:"triggerId"`
	TenantID      string          `db:"tenant_id" json:"tenantId"`
	TriggeredAt   time.Time       `db:"triggered_at" json:"triggeredAt"`
	Status        ExecutionStatus `db:"status" json:"status"`
	PipelineRunID string          `db:"pipeline_run_id" json:"pipelineRunId"`
	Error         string          `db:"error" json:"error"`
	CreatedAt     time.Time       `db:"created_at" json:"createdAt"`
}

// --- Request types ---

// CreateTriggerRequest is the body for creating a trigger.
type CreateTriggerRequest struct {
	Name           string      `json:"name" binding:"required"`
	TriggerType    TriggerType `json:"triggerType" binding:"required"`
	Expression     string      `json:"expression"`
	TargetPipeline string      `json:"targetPipeline" binding:"required"`
	Enabled        *bool       `json:"enabled"` // nil -> default true
}

// UpdateTriggerRequest is the body for partial trigger updates.
type UpdateTriggerRequest struct {
	Name           *string     `json:"name"`
	TriggerType    *TriggerType `json:"triggerType"`
	Expression     *string     `json:"expression"`
	TargetPipeline *string     `json:"targetPipeline"`
	Status         *TriggerStatus `json:"status"`
	Enabled        *bool       `json:"enabled"`
}

// TriggerExecuteRequest is the body for manual/API trigger execution.
type TriggerExecuteRequest struct {
	Ref     string `json:"ref"`     // git ref for push-based triggers (optional)
	Message string `json:"message"` // reason for manual/API trigger (optional)
}
