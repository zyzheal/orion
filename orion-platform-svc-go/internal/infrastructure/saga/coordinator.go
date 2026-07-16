package saga

import (
	"context"
	"time"
)

// SagaCoordinator manages distributed transactions using the Saga pattern.
type SagaCoordinator interface {
	// StartSaga begins a new saga with the given type and context.
	StartSaga(ctx context.Context, tenantID, sagaType string, steps []SagaStep, ctxData map[string]interface{}) (*SagaInstance, error)

	// CommitStep marks the current step as completed and advances to the next.
	CommitStep(ctx context.Context, sagaID string, stepID string, result map[string]interface{}) error

	// Rollback triggers compensation for all completed steps in reverse order.
	Rollback(ctx context.Context, sagaID string, reason string) error

	// Complete marks the saga as fully completed.
	Complete(ctx context.Context, sagaID string) error

	// GetSaga retrieves a saga instance by ID.
	GetSaga(ctx context.Context, tenantID, sagaID string) (*SagaInstance, error)

	// ListPending returns all pending sagas for a tenant.
	ListPending(ctx context.Context, tenantID string) ([]*SagaInstance, error)
}

// SagaStep defines a single step in a saga with both action and compensation.
type SagaStep struct {
	ID            string            `json:"id"`
	Name          string            `json:"name"`
	ExecuteFunc   StepExecuteFunc   `json:"-"`
	CompensateFunc StepCompensateFunc `json:"-"`
}

// StepExecuteFunc is the action to perform when executing a step.
type StepExecuteFunc func(ctx context.Context, saga *SagaInstance, ctxData map[string]interface{}) (map[string]interface{}, error)

// StepCompensateFunc is the compensation action to undo a step.
type StepCompensateFunc func(ctx context.Context, saga *SagaInstance, stepResult map[string]interface{}) error

// SagaStatus represents the current state of a saga.
type SagaStatus string

const (
	StatusPending      SagaStatus = "PENDING"
	StatusRunning      SagaStatus = "RUNNING"
	StatusCompleted    SagaStatus = "COMPLETED"
	StatusCompensating SagaStatus = "COMPENSATING"
	StatusCompensated  SagaStatus = "COMPENSATED"
	StatusFailed       SagaStatus = "FAILED"
)

// SagaInstance represents a running or completed saga.
type SagaInstance struct {
	ID            string            `db:"id" json:"id"`
	SagaType      string            `db:"saga_type" json:"sagaType"`
	TenantID      string            `db:"tenant_id" json:"tenantId"`
	Status        SagaStatus        `db:"status" json:"status"`
	CurrentStep   int               `db:"current_step" json:"currentStep"`
	TotalSteps    int               `db:"total_steps" json:"totalSteps"`
	ContextData   map[string]interface{} `db:"context" json:"context"`
	Steps         []SagaStepResult  `db:"steps" json:"steps"`
	CompensationLog []SagaCompensation `db:"compensation_log" json:"compensationLog"`
	CreatedAt     time.Time         `db:"created_at" json:"createdAt"`
	UpdatedAt     time.Time         `db:"updated_at" json:"updatedAt"`
}

// SagaStepResult records the outcome of a single step.
type SagaStepResult struct {
	StepID   string                 `db:"step_id" json:"stepId"`
	Status   string                 `db:"status" json:"status"` // EXECUTING/COMPLETED/COMPENSATED/FAILED
	Result   map[string]interface{} `db:"result" json:"result"`
	Error    string                 `db:"error" json:"error"`
	ExecutedAt *time.Time           `db:"executed_at" json:"executedAt"`
}

// SagaCompensation records a compensation action.
type SagaCompensation struct {
	StepID    string    `db:"step_id" json:"stepId"`
	Status    string    `db:"status" json:"status"` // RUNNING/COMPLETED/FAILED
	Error     string    `db:"error" json:"error"`
	ExecutedAt time.Time `db:"executed_at" json:"executedAt"`
}
