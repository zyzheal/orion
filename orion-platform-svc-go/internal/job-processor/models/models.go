// Package models defines domain types for the Job Operation Processor.
//
// The processor provides a state-machine-driven orchestrator for job operations
// (create, update, delete, run, pause, resume, cancel) with chaining and
// transactional support. It sits on top of the job-actions executor.
package models

import "time"

// ---------------------------------------------------------------------------
// Operation type constants
// ---------------------------------------------------------------------------

const (
	TypeCreate = "create"
	TypeUpdate = "update"
	TypeDelete = "delete"
	TypeRun    = "run"
	TypePause  = "pause"
	TypeResume = "resume"
	TypeCancel = "cancel"
)

// AllOperationTypes lists every supported operation type.
var AllOperationTypes = []string{
	TypeCreate, TypeUpdate, TypeDelete,
	TypeRun, TypePause, TypeResume, TypeCancel,
}

// ---------------------------------------------------------------------------
// Status constants for JobOperation
// ---------------------------------------------------------------------------

const (
	StatusPending   = "pending"
	StatusRunning   = "running"
	StatusCompleted = "completed"
	StatusFailed    = "failed"
	StatusPaused    = "paused"
	StatusCancelled = "cancelled"
)

// ValidOperationStatuses is the set of valid statuses.
var ValidOperationStatuses = map[string]bool{
	StatusPending:   true,
	StatusRunning:   true,
	StatusCompleted: true,
	StatusFailed:    true,
	StatusPaused:    true,
	StatusCancelled: true,
}

// ---------------------------------------------------------------------------
// JobOperation — a single operation in the processor
// ---------------------------------------------------------------------------

// JobOperation represents a single operation to execute. It carries the
// operation type (create/update/delete/run/pause/resume/cancel), the target
// resource identifier, execution parameters, and the resulting status + data.
type JobOperation struct {
	ID        string `json:"id" db:"id"`
	TenantID  string `json:"tenant_id" db:"tenant_id"`
	ChainID   string `json:"chain_id" db:"chain_id"`
	Type      string `json:"type" db:"type"`      // create|update|delete|run|pause|resume|cancel
	Target    string `json:"target" db:"target"`  // resource identifier (e.g. job ID, action name)
	Params    string `json:"params" db:"params"`  // JSON: operation parameters
	Result    string `json:"result" db:"result"`  // JSON: operation result data
	Status    string `json:"status" db:"status"`
	Error     string `json:"error" db:"error"`
	Order     int    `json:"order" db:"order"`    // position within a chain
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// ---------------------------------------------------------------------------
// JobOperationChain — a group of operations executed atomically
// ---------------------------------------------------------------------------

type JobOperationChain struct {
	ID        string     `json:"id" db:"id"`
	TenantID  string     `json:"tenant_id" db:"tenant_id"`
	Name      string     `json:"name" db:"name"`
	Status    string     `json:"status" db:"status"`
	Error     string     `json:"error" db:"error"`
	CreatedAt time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt time.Time  `json:"updated_at" db:"updated_at"`
}

// ---------------------------------------------------------------------------
// Request / response DTOs
// ---------------------------------------------------------------------------

// CreateOperationRequest is the request body for creating a single operation.
type CreateOperationRequest struct {
	Type   string            `json:"type" binding:"required"`
	Target string            `json:"target" binding:"required"`
	Params map[string]string `json:"params"`
}

// CreateChainRequest is the request body for creating a batch of chained operations.
type CreateChainRequest struct {
	Name       string                 `json:"name" binding:"required"`
	Operations []CreateOperationDTO   `json:"operations" binding:"required"`
}

// CreateOperationDTO is a single operation inside a chain request.
type CreateOperationDTO struct {
	Type   string            `json:"type" binding:"required"`
	Target string            `json:"target" binding:"required"`
	Params map[string]string `json:"params"`
}

// UpdateOperationStatusRequest is the request body for changing operation status.
type UpdateOperationStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

// OperationListResponse is the paginated list of operations.
type OperationListResponse struct {
	Total int             `json:"total"`
	Data  []JobOperation `json:"data"`
}

// ChainListResponse is the paginated list of chains.
type ChainListResponse struct {
	Total int                    `json:"total"`
	Data  []JobOperationChain `json:"data"`
}
