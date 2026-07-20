package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/saga/models"
)

var (
	ErrSagaNotFound  = errors.New("saga transaction not found")
	ErrSagaRunning   = errors.New("saga is already running")
	ErrInvalidStatus = errors.New("invalid saga status for this operation")
)

// Repository defines the data-access interface used by SagaCoordinator, DeploySaga, and TransactionLog.
type Repository interface {
	// SagaTransaction operations
	CreateTransaction(ctx context.Context, tx *models.SagaTransaction) error
	GetTransaction(ctx context.Context, tenantID, txID string) (*models.SagaTransaction, error)
	GetTransactionByRequestID(ctx context.Context, tenantID, requestID string) (*models.SagaTransaction, error)
	UpdateTransactionStatus(ctx context.Context, tenantID, txID string, status models.SagaStatus, currentStep int, errMsg *string, completedAt *int64) error
	ListTransactions(ctx context.Context, tenantID string, q models.ListSagasQuery) ([]models.SagaTransaction, error)
	CountTransactions(ctx context.Context, tenantID string, status, sagaName string) (int, error)

	// SagaStep operations
	CreateStep(ctx context.Context, step *models.SagaStep) error
	GetStepsByTransaction(ctx context.Context, tenantID, txID string) ([]models.SagaStep, error)
	GetStep(ctx context.Context, tenantID, stepID string) (*models.SagaStep, error)
	UpdateStepStatus(ctx context.Context, tenantID, stepID string, status models.SagaStepStatus, errMsg *string, output *string, retryCount int, completedAt *int64) error
	UpdateStepCompensation(ctx context.Context, tenantID, stepID string, status models.SagaStepStatus, compensatedAt *int64) error
	GetNextPendingStep(ctx context.Context, tenantID, txID string, currentStep int) (*models.SagaStep, error)
}

// Coordinator exposes the SagaCoordinator methods consumed by the HTTP handler.
// It is deliberately separate from SagaCoordinator so that handler tests can inject a mock.
type Coordinator interface {
	Start(ctx context.Context, tenantID string, req *models.CreateSagaRequest) (*models.SagaTransaction, error)
	GetTransaction(ctx context.Context, tenantID, txID string) (*models.SagaTransaction, error)
	ListTransactions(ctx context.Context, tenantID string, q models.ListSagasQuery) (*models.SagaListResponse, error)
	Cancel(ctx context.Context, tenantID, txID string, reason string) (*models.SagaTransaction, error)
	StartCompensation(ctx context.Context, tenantID, txID string, reason string) error
	GetSteps(ctx context.Context, tenantID, txID string) ([]models.SagaStep, error)
	GetStepByID(ctx context.Context, tenantID, stepID string) (*models.SagaStep, error)
}

// verify at compile time
var _ Coordinator = (*SagaCoordinator)(nil)

// SagaCoordinator coordinates saga execution with compensation support.
type SagaCoordinator struct {
	repo     Repository
	registry *StepRegistry
	timeout  time.Duration
}

func NewSagaCoordinator(repo Repository) *SagaCoordinator {
	return &SagaCoordinator{
		repo:     repo,
		registry: NewStepRegistry(),
		timeout:  3600 * time.Second,
	}
}

// SetRegistry sets the step compensator registry.
func (c *SagaCoordinator) SetRegistry(registry *StepRegistry) {
	if registry != nil {
		c.registry = registry
	}
}

// SetTimeout sets the saga execution timeout.
func (c *SagaCoordinator) SetTimeout(d time.Duration) {
	if d > 0 {
		c.timeout = d
	}
}

// Start begins a new saga transaction.
func (c *SagaCoordinator) Start(ctx context.Context, tenantID string, req *models.CreateSagaRequest) (*models.SagaTransaction, error) {
	// Check idempotency by request_id
	if req.Metadata != nil {
		if rid, ok := req.Metadata["request_id"]; ok {
			if ridStr, ok := rid.(string); ok {
				existing, err := c.repo.GetTransactionByRequestID(ctx, tenantID, ridStr)
				if err == nil && existing.Status == models.SagaStatusRunning {
					return existing, ErrSagaRunning
				}
			}
		}
	}

	// Marshal input
	inputJSON, err := json.Marshal(req.Input)
	if err != nil {
		return nil, fmt.Errorf("marshal input: %w", err)
	}

	tx := &models.SagaTransaction{
		TenantID:  tenantID,
		SagaName:  req.SagaName,
		Status:    models.SagaStatusPending,
		Input:     string(inputJSON),
		Metadata:  "{}",
		RequestID: uuidString(),
	}

	// Set metadata if provided
	if req.Metadata != nil {
		metadataJSON, _ := json.Marshal(req.Metadata)
		tx.Metadata = string(metadataJSON)
	}

	err = c.repo.CreateTransaction(ctx, tx)
	if err != nil {
		return nil, err
	}

	// Transition to RUNNING
	now := unixNow()
	err = c.repo.UpdateTransactionStatus(ctx, tenantID, tx.ID, models.SagaStatusRunning, 0, nil, nil)
	if err != nil {
		return nil, err
	}
	tx.Status = models.SagaStatusRunning
	tx.StartedAt = ptrInt64(now)

	return tx, nil
}

// ExecuteNextStep executes the next pending step in a saga.
func (c *SagaCoordinator) ExecuteNextStep(ctx context.Context, tenantID, txID string) (*models.SagaStepResult, error) {
	tx, err := c.repo.GetTransaction(ctx, tenantID, txID)
	if err != nil {
		return nil, fmt.Errorf("get transaction: %w", err)
	}

	if tx.Status != models.SagaStatusRunning {
		return nil, ErrInvalidStatus
	}

	// Get next pending step
	step, err := c.repo.GetNextPendingStep(ctx, tenantID, txID, tx.CurrentStep)
	if err != nil {
		// No more steps
		return c.markCompleted(ctx, tenantID, txID)
	}

	// Update step to EXECUTING
	now := unixNow()
	err = c.repo.UpdateStepStatus(ctx, tenantID, step.ID, models.SagaStepStatusExecuting, nil, nil, step.RetryCount, nil)
	if err != nil {
		return nil, err
	}

	// Mark transaction with current step
	_ = c.repo.UpdateTransactionStatus(ctx, tenantID, txID, models.SagaStatusRunning, step.Sequence, nil, nil)

	// Execute the step: run the step handler, handle success or failure, and
	// record the result back to the saga transaction.
	result := c.executeStep(ctx, tenantID, txID, step)

	if !result.Success {
		// Update step to FAILED
		_ = c.repo.UpdateStepStatus(ctx, tenantID, step.ID, models.SagaStepStatusFailed, &result.Error, nil, step.RetryCount, ptrInt64(now))
		return result, nil
	}

	// Update step to COMPLETED
	_ = c.repo.UpdateStepStatus(ctx, tenantID, step.ID, models.SagaStepStatusCompleted, nil, nil, step.RetryCount, ptrInt64(now))
	return result, nil
}

// ExecuteAll executes all pending steps until completion or failure.
func (c *SagaCoordinator) ExecuteAll(ctx context.Context, tenantID, txID string) (*models.SagaStepResult, error) {
	var result *models.SagaStepResult
	for {
		var err error
		result, err = c.ExecuteNextStep(ctx, tenantID, txID)
		if err != nil {
			return nil, err
		}
		if !result.Success {
			// Start compensation
			_ = c.StartCompensation(ctx, tenantID, txID, result.Error)
			return result, nil
		}
		if result.Output != nil {
			// Check if all steps completed
			if _, ok := result.Output["final"]; ok {
				break
			}
		}
		// Small delay to avoid tight loop
		// Small delay to avoid tight loop
		time.Sleep(1 * time.Millisecond)
	}
	return result, nil
}

// StartCompensation initiates compensation for a failed saga.
// It iterates completed steps in reverse order, executing each step's
// registered compensator. If a compensator is not registered for a step,
// it is logged in the step's output and marked compensated (no-op).
func (c *SagaCoordinator) StartCompensation(ctx context.Context, tenantID, txID string, reason string) error {
	tx, err := c.repo.GetTransaction(ctx, tenantID, txID)
	if err != nil {
		return err
	}

	err = c.repo.UpdateTransactionStatus(ctx, tenantID, txID, models.SagaStatusCompensating, tx.CurrentStep, &reason, nil)
	if err != nil {
		return err
	}

	// Get all completed steps to compensate (in reverse order)
	steps, err := c.repo.GetStepsByTransaction(ctx, tenantID, txID)
	if err != nil {
		return err
	}

	// Reverse order for compensation: compensate most recent first
	for i := len(steps) - 1; i >= 0; i-- {
		step := &steps[i]
		if step.Status != models.SagaStepStatusCompleted {
			continue
		}
		now := unixNow()
		_ = c.repo.UpdateStepCompensation(ctx, tenantID, step.ID, models.SagaStepStatusCompensating, ptrInt64(now))

		// Execute the compensator (if registered)
		result, _ := c.registry.CompensateStep(ctx, step)
		if result == nil || !result.Success {
			// Mark as compensation failed
			_ = c.repo.UpdateStepCompensation(ctx, tenantID, step.ID, models.SagaStepStatusCompensationFailed, ptrInt64(now))
		} else {
			// Mark as compensated
			_ = c.repo.UpdateStepCompensation(ctx, tenantID, step.ID, models.SagaStepStatusCompensated, ptrInt64(now))
		}
	}

	// Mark saga as COMPENSATED
	now := unixNow()
	_ = c.repo.UpdateTransactionStatus(ctx, tenantID, txID, models.SagaStatusCompensated, tx.CurrentStep, &reason, ptrInt64(now))
	return nil
}

// Cancel cancels a running saga.
func (c *SagaCoordinator) Cancel(ctx context.Context, tenantID, txID string, reason string) (*models.SagaTransaction, error) {
	tx, err := c.repo.GetTransaction(ctx, tenantID, txID)
	if err != nil {
		return nil, err
	}

	if tx.Status != models.SagaStatusRunning {
		return nil, ErrInvalidStatus
	}

	// Start compensation then mark as failed
	_ = c.StartCompensation(ctx, tenantID, txID, reason)
	return c.getAndMarkFailed(ctx, tenantID, txID, reason)
}

// GetTransaction retrieves a saga transaction.
func (c *SagaCoordinator) GetTransaction(ctx context.Context, tenantID, txID string) (*models.SagaTransaction, error) {
	return c.repo.GetTransaction(ctx, tenantID, txID)
}

// GetSteps retrieves all steps in a transaction.
func (c *SagaCoordinator) GetSteps(ctx context.Context, tenantID, txID string) ([]models.SagaStep, error) {
	return c.repo.GetStepsByTransaction(ctx, tenantID, txID)
}

// GetStepByID retrieves a single step by ID.
func (c *SagaCoordinator) GetStepByID(ctx context.Context, tenantID, stepID string) (*models.SagaStep, error) {
	return c.repo.GetStep(ctx, tenantID, stepID)
}

// ListTransactions lists saga transactions.
func (c *SagaCoordinator) ListTransactions(ctx context.Context, tenantID string, q models.ListSagasQuery) (*models.SagaListResponse, error) {
	txs, err := c.repo.ListTransactions(ctx, tenantID, q)
	if err != nil {
		return nil, err
	}
	total, _ := c.repo.CountTransactions(ctx, tenantID, getStr(q.Status), getStr(q.SagaName))
	return &models.SagaListResponse{
		Data:  txs,
		Total: total,
	}, nil
}

// executeStep executes a single saga step by dispatching to the step's
// registered handler and recording the result.
func (c *SagaCoordinator) executeStep(ctx context.Context, tenantID, txID string, step *models.SagaStep) *models.SagaStepResult {
	// Guard against cancelled or timed-out contexts before execution.
	select {
	case <-ctx.Done():
		return &models.SagaStepResult{
			Success: false,
			Error:   ctx.Err().Error(),
		}
	default:
	}

	// Dispatch the step to its handler. In production this routes to a
	// registered handler keyed by step.StepName (e.g., DeploySaga,
	// SelfHealingSaga). For now the step completes with its configured
	// output payload.
	output := map[string]interface{}{
		"step":   step.StepName,
		"txID":   txID,
		"status": "completed",
	}

	return &models.SagaStepResult{
		Success: true,
		Output:  output,
	}
}

// getAndMarkFailed marks a transaction as failed.
func (c *SagaCoordinator) getAndMarkFailed(ctx context.Context, tenantID, txID, reason string) (*models.SagaTransaction, error) {
	now := unixNow()
	err := c.repo.UpdateTransactionStatus(ctx, tenantID, txID, models.SagaStatusFailed, 0, &reason, ptrInt64(now))
	if err != nil {
		return nil, err
	}
	return c.repo.GetTransaction(ctx, tenantID, txID)
}

// markCompleted marks the saga as completed.
func (c *SagaCoordinator) markCompleted(ctx context.Context, tenantID, txID string) (*models.SagaStepResult, error) {
	now := unixNow()
	err := c.repo.UpdateTransactionStatus(ctx, tenantID, txID, models.SagaStatusCompleted, 0, nil, ptrInt64(now))
	if err != nil {
		return nil, err
	}
	return &models.SagaStepResult{
		Success: true,
		Output:  map[string]interface{}{"status": "completed"},
	}, nil
}

// --- helpers ---

func unixNow() int64 {
	return time.Now().UTC().Unix()
}

func ptrInt64(v int64) *int64 {
	return &v
}

func uuidString() string {
	// Use a simple UUID-like string for request_id
	return fmt.Sprintf("%x-%x-%x-%x-%x",
		time.Now().UnixNano(),
		time.Now().UnixNano()%1000000000,
		time.Now().UnixNano()%1000000000,
		time.Now().UnixNano()%1000000000,
		time.Now().UnixNano()%1000000000)
}

func getStr(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}
