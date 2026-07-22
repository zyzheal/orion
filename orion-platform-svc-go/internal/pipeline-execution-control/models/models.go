package models

import "time"

// ExecutionControlLog records an execution control action on a pipeline run.
type ExecutionControlLog struct {
	ID        string     `db:"id" json:"id"`
	TenantID  string     `db:"tenant_id" json:"tenantId"`
	RunID     string     `db:"run_id" json:"runId"`
	Action    string     `db:"action" json:"action"` // pause|resume|abort|retry|restart
	Reason    *string    `db:"reason" json:"reason"`
	Operator  *string    `db:"operator" json:"operator"`
	Metadata  *string    `db:"metadata" json:"metadata"` // JSON text
	CreatedAt time.Time  `db:"created_at" json:"createdAt"`
}

// Checkpoint represents a saved execution checkpoint for a pipeline run.
type Checkpoint struct {
	ID        string    `db:"id" json:"id"`
	TenantID  string    `db:"tenant_id" json:"tenantId"`
	RunID     string    `db:"run_id" json:"runId"`
	StageID   string    `db:"stage_id" json:"stageId"`
	StageName string    `db:"stage_name" json:"stageName"`
	Data      *string   `db:"data" json:"data"` // JSON text
	CreatedAt time.Time `db:"created_at" json:"createdAt"`
}

// Run is a minimal representation of a pipeline run for status operations.
type Run struct {
	ID          string     `db:"id" json:"id"`
	TenantID    string     `db:"tenant_id" json:"tenantId"`
	Status      string     `db:"status" json:"status"`
	StartedAt   *time.Time `db:"started_at" json:"startedAt"`
	CompletedAt *time.Time `db:"completed_at" json:"completedAt"`
	CreatedAt   time.Time  `db:"created_at" json:"createdAt"`
	UpdatedAt   time.Time  `db:"updated_at" json:"updatedAt"`
}

// --- Request types ---

type PauseRequest struct {
	Reason   *string `json:"reason"`
	Operator *string `json:"operator"`
}

type ResumeRequest struct {
	Reason   *string `json:"reason"`
	Operator *string `json:"operator"`
}

type AbortRequest struct {
	Reason        *string `json:"reason"`
	Operator      *string `json:"operator"`
	TimeoutSeconds *int   `json:"timeoutSeconds"`
}

type RetryRequest struct {
	FromCheckpoint *string `json:"fromCheckpoint"`
	Operator       *string `json:"operator"`
}

type RestartRequest struct {
	Reason   *string `json:"reason"`
	Operator *string `json:"operator"`
}

// --- Response types ---

type CheckpointListResponse struct {
	Data  []Checkpoint `json:"data"`
	Total int          `json:"total"`
}

type ControlLogListResponse struct {
	Data  []ExecutionControlLog `json:"data"`
	Total int                   `json:"total"`
}