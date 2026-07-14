package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/saga/models"
	"orion/platform-svc-go/internal/saga/repository"
)

var (
	ErrSagaNotFound   = errors.New("saga transaction not found")
	ErrSagaRunning    = errors.New("saga is already running")
	ErrInvalidStatus  = errors.New("invalid saga status for this operation")
)

// SagaCoordinator coordinates saga execution with compensation support.
type SagaCoordinator struct {
	repo    *repository.Repository
	timeout time.Duration
}

func NewSagaCoordinator(repo *repository.Repository) *SagaCoordinator {
	return &SagaCoordinator{
		repo:    repo,
		timeout: 3600 * time.Second,
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

	// Execute step (placeholder - in production this calls the step's execute function)
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

	// Reverse order for compensation
	for i := len(steps) - 1; i >= 0; i-- {
		step := &steps[i]
		if step.Status == models.SagaStepStatusCompleted {
			now := unixNow()
			_ = c.repo.UpdateStepCompensation(ctx, tenantID, step.ID, models.SagaStepStatusCompensating, ptrInt64(now))
			// Placeholder: in production this calls the step's compensate function
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

// executeStep executes a step (placeholder).
func (c *SagaCoordinator) executeStep(ctx context.Context, tenantID, txID string, step *models.SagaStep) *models.SagaStepResult {
	// Placeholder: in production this would call the step's execute function
	// based on the step definition (DeploySaga, SelfHealingSaga, etc.)
	// Simulate brief execution
	time.Sleep(5 * time.Millisecond)

	// Check for context cancellation
	select {
	case <-ctx.Done():
		return &models.SagaStepResult{
			Success: false,
			Error:   "context cancelled",
		}
	default:
	}

	// Simulate step completion
	output := map[string]interface{}{
		"step":   step.StepName,
		"status": "completed",
	}
	if step.Sequence == 0 {
		output["final"] = true // Mark as last step for testing
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
