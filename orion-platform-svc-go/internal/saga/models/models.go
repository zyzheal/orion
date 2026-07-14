package models

// SagaStepStatus represents the status of a saga step.
type SagaStepStatus string

const (
	SagaStepStatusPending         SagaStepStatus = "pending"
	SagaStepStatusExecuting       SagaStepStatus = "executing"
	SagaStepStatusCompleted       SagaStepStatus = "completed"
	SagaStepStatusCompensating    SagaStepStatus = "compensating"
	SagaStepStatusCompensated     SagaStepStatus = "compensated"
	SagaStepStatusFailed          SagaStepStatus = "failed"
	SagaStepStatusCompensationFailed SagaStepStatus = "compensation_failed"
)

// SagaStatus represents the overall saga status.
type SagaStatus string

const (
	SagaStatusPending      SagaStatus = "pending"
	SagaStatusRunning      SagaStatus = "running"
	SagaStatusCompleted    SagaStatus = "completed"
	SagaStatusCompensating SagaStatus = "compensating"
	SagaStatusCompensated  SagaStatus = "compensated"
	SagaStatusFailed       SagaStatus = "failed"
)

// SagaDefinition defines a saga workflow.
type SagaDefinition struct {
	Name  string          `db:"name" json:"name"`
	Steps []SagaStepDef   `json:"steps"`
}

// SagaStepDef defines a single step in a saga.
type SagaStepDef struct {
	Name      string                 `db:"name" json:"name"`
	Sequence  int                    `db:"sequence" json:"sequence"`
	RetryMax  int                    `db:"retry_max" json:"retry_max"`
	RetryDelay int                   `db:"retry_delay" json:"retry_delay"`
	TimeoutMs int                    `db:"timeout_ms" json:"timeout_ms"`
}

// SagaTransaction represents a saga execution instance.
type SagaTransaction struct {
	ID              string         `db:"id" json:"id"`
	TenantID        string         `db:"tenant_id" json:"tenant_id"`
	SagaName        string         `db:"saga_name" json:"saga_name"`
	RequestID       string         `db:"request_id" json:"request_id"`
	Status          SagaStatus     `db:"status" json:"status"`
	Input           string         `db:"input" json:"input"` // JSON
	Metadata        string         `db:"metadata" json:"metadata"` // JSON
	CurrentStep     int            `db:"current_step" json:"current_step"`
	Error           *string        `db:"error" json:"error"`
	StartedAt       *int64         `db:"started_at" json:"started_at"`
	CompletedAt     *int64         `db:"completed_at" json:"completed_at"`
	CreatedAt       int64          `db:"created_at" json:"created_at"`
	UpdatedAt       int64          `db:"updated_at" json:"updated_at"`
}

// SagaStep represents an execution record for a saga step.
type SagaStep struct {
	ID                     string         `db:"id" json:"id"`
	TenantID               string         `db:"tenant_id" json:"tenant_id"`
	TransactionID          string         `db:"transaction_id" json:"transaction_id"`
	StepName               string         `db:"step_name" json:"step_name"`
	Sequence               int            `db:"sequence" json:"sequence"`
	Status                 SagaStepStatus `db:"status" json:"status"`
	Input                  string         `db:"input" json:"input"` // JSON
	Output                 *string        `db:"output" json:"output"` // JSON
	Error                  *string        `db:"error" json:"error"`
	RetryCount             int            `db:"retry_count" json:"retry_count"`
	StartedAt              *int64         `db:"started_at" json:"started_at"`
	CompletedAt            *int64         `db:"completed_at" json:"completed_at"`
	CompensationStartedAt  *int64         `db:"compensation_started_at" json:"compensation_started_at"`
	CompensationCompletedAt *int64        `db:"compensation_completed_at" json:"compensation_completed_at"`
	CreatedAt              int64          `db:"created_at" json:"created_at"`
	UpdatedAt              int64          `db:"updated_at" json:"updated_at"`
}

// SagaStepResult holds the result of step execution.
type SagaStepResult struct {
	Success bool
	Output  map[string]interface{}
	Error   string
}

// CreateSagaRequest for starting a new saga.
type CreateSagaRequest struct {
	SagaName string                 `json:"saga_name" binding:"required"`
	Input    map[string]interface{} `json:"input" binding:"required"`
	Metadata map[string]interface{} `json:"metadata"`
}

// CancelSagaRequest for cancelling a running saga.
type CancelSagaRequest struct {
	Reason string `json:"reason"`
}

// ListSagasQuery for listing saga transactions.
type ListSagasQuery struct {
	Status *string `form:"status"`
	SagaName *string `form:"saga_name"`
	Limit  int     `form:"limit,default=50"`
	Offset int     `form:"offset,default=0"`
}

// SagaListResponse for list sagas response.
type SagaListResponse struct {
	Data  []SagaTransaction `json:"data"`
	Total int               `json:"total"`
}

// GetStepsQuery for listing steps in a transaction.
type GetStepsQuery struct {
	Status *string `form:"status"`
}
