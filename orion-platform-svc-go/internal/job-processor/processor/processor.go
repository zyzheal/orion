// Package processor provides a state-machine-driven orchestrator for job
// operations (create/update/delete/run/pause/resume/cancel) with chaining
// and transactional support.
//
// The Processor manages a lifecycle:
//   pending → running → completed|failed
//
// And supports pausing/resuming/cancelling at the operation level and chain level.
package processor

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"

	"go.uber.org/zap"

	"orion/platform-svc-go/internal/job-processor/models"
	"orion/platform-svc-go/internal/job-processor/repository"
)

// Errors — processor-level domain errors.
var (
	ErrUnknownOperationType = errors.New("unknown operation type")
	ErrInvalidStatus        = errors.New("invalid operation status")
	ErrInvalidTransition    = errors.New("invalid status transition")
	ErrChainNotFound        = errors.New("operation chain not found")
)

// Valid transitions for the operation state machine.
// Key = "from:to", value = true means the transition is allowed.
var validTransitions = map[string]bool{
	"pending:running":   true,
	"pending:cancelled": true,
	"pending:paused":    true,
	"running:completed": true,
	"running:failed":    true,
	"running:cancelled": true,
	"running:paused":    true,
	"paused:running":    true,
	"paused:cancelled":  true,
}

// ---------------------------------------------------------------------------
// Processor — the orchestrator
// ---------------------------------------------------------------------------

type Processor struct {
	repo   *repository.Repository
	logger *zap.Logger
	mu     sync.RWMutex
}

func NewProcessor(repo *repository.Repository, logger *zap.Logger) *Processor {
	return &Processor{repo: repo, logger: logger}
}

// ---------------------------------------------------------------------------
// Single operation
// ---------------------------------------------------------------------------

// Process executes a single job operation with proper state management.
//
// The operation goes through: pending → running → completed|failed|cancelled.
// The caller can pass an optional chainID to group operations.
func (p *Processor) Process(ctx context.Context, tenantID string, req *models.CreateOperationRequest, chainID string) (*models.JobOperation, error) {
	// Validate operation type
	if !isValidOperationType(req.Type) {
		return nil, fmt.Errorf("%w: %s", ErrUnknownOperationType, req.Type)
	}

	// Serialize params
	paramsJSON := "{}"
	if req.Params != nil {
		b, err := json.Marshal(req.Params)
		if err != nil {
			return nil, err
		}
		paramsJSON = string(b)
	}

	// Build operation
	op := &models.JobOperation{
		TenantID: tenantID,
		ChainID:  chainID,
		Type:     req.Type,
		Target:   req.Target,
		Params:   paramsJSON,
		Status:   models.StatusPending,
	}

	if err := p.repo.CreateOperation(ctx, op); err != nil {
		p.logger.Error("failed to create job operation",
			zap.String("id", op.ID),
			zap.String("type", req.Type),
			zap.Error(err),
		)
		return nil, err
	}

	// Execute the operation
	op, execErr := p.executeOperation(ctx, tenantID, op)

	// Update chain status if this operation belongs to one
	if chainID != "" {
		if chainErr := p.updateChainStatus(ctx, tenantID, chainID, execErr); chainErr != nil {
			p.logger.Warn("failed to update chain status after operation",
				zap.String("chainID", chainID),
				zap.Error(chainErr),
		)
		}
	}

	if execErr != nil {
		return op, execErr
	}
	return op, nil
}

// GetOperation retrieves a single operation by ID.
func (p *Processor) GetOperation(ctx context.Context, tenantID, id string) (*models.JobOperation, error) {
	return p.repo.GetOperation(ctx, tenantID, id)
}

// ListOperations returns paginated operations (optionally scoped to a chain).
func (p *Processor) ListOperations(ctx context.Context, tenantID, chainID string, limit, offset int) (*models.OperationListResponse, error) {
	return p.repo.ListOperations(ctx, tenantID, chainID, limit, offset)
}

// ---------------------------------------------------------------------------
// Chained / transactional operations
// ---------------------------------------------------------------------------

// ProcessChain creates a chain and executes all operations in order.
// The chain is transactional: if one operation fails, the chain is marked failed
// and subsequent operations in the chain are cancelled.
func (p *Processor) ProcessChain(ctx context.Context, tenantID string, req *models.CreateChainRequest) (*models.JobOperationChain, error) {
	// Create chain
	chain, err := p.repo.CreateChain(ctx, tenantID, req.Name)
	if err != nil {
		return nil, err
	}

	var firstErr error
	for i, dto := range req.Operations {
		// Skip if context cancelled or chain already failed
		if ctx.Err() != nil {
			p.markChainCancelled(ctx, tenantID, chain.ID)
			break
		}
		if firstErr != nil {
			p.logger.Warn("skipping operation due to prior failure in chain",
				zap.String("chainID", chain.ID),
				zap.Int("order", i),
			)
			continue
		}

		req2 := &models.CreateOperationRequest{
			Type:   dto.Type,
			Target: dto.Target,
			Params: dto.Params,
		}

		// Set order before creating
		p.mu.Lock()
		op, opErr := p.processWithOrder(ctx, tenantID, req2, chain.ID, i)
		p.mu.Unlock()
		if opErr != nil {
			firstErr = opErr
			p.logger.Error("chain operation failed",
				zap.String("chainID", chain.ID),
				zap.String("operationID", op.ID),
				zap.Int("order", i),
				zap.Error(opErr),
			)
		}
	}

	// Finalize chain status
	if updateErr := p.updateChainStatus(ctx, tenantID, chain.ID, firstErr); updateErr != nil {
		p.logger.Warn("failed to finalize chain status",
			zap.String("chainID", chain.ID),
			zap.Error(updateErr),
		)
	}

	chain.Status = models.StatusCompleted
	if firstErr != nil {
		chain.Status = models.StatusFailed
		chain.Error = firstErr.Error()
	}
	return chain, firstErr
}

// processWithOrder is like Process but sets the operation's order before saving.
func (p *Processor) processWithOrder(ctx context.Context, tenantID string, req *models.CreateOperationRequest, chainID string, order int) (*models.JobOperation, error) {
	paramsJSON := "{}"
	if req.Params != nil {
		b, _ := json.Marshal(req.Params)
		paramsJSON = string(b)
	}
	op := &models.JobOperation{
		TenantID: tenantID,
		ChainID:  chainID,
		Type:     req.Type,
		Target:   req.Target,
		Params:   paramsJSON,
		Status:   models.StatusPending,
		Order:    order,
	}
	if err := p.repo.CreateOperation(ctx, op); err != nil {
		return nil, err
	}
	return p.executeOperation(ctx, tenantID, op)
}

// CancelChain cancels a chain and all pending/running operations within it.
func (p *Processor) CancelChain(ctx context.Context, tenantID, chainID string) (*models.JobOperationChain, error) {
	chain, err := p.repo.GetChain(ctx, tenantID, chainID)
	if err != nil {
		return nil, fmt.Errorf("%w: %s", ErrChainNotFound, chainID)
	}
	if chain.Status == models.StatusCompleted || chain.Status == models.StatusCancelled {
		return chain, nil
	}
	opsResp, listErr := p.repo.ListOperations(ctx, tenantID, chainID, 100, 0)
	if listErr != nil {
		return nil, listErr
	}
	for _, op := range opsResp.Data {
		if op.Status == models.StatusPending || op.Status == models.StatusRunning || op.Status == models.StatusPaused {
			_ = p.repo.UpdateStatus(ctx, tenantID, op.ID, models.StatusCancelled, "", "cancelled by chain cancel")
		}
	}
	return p.repo.UpdateChain(ctx, tenantID, chainID, map[string]interface{}{
		"status": models.StatusCancelled,
		"error":  "cancelled",
	})
}

// ---------------------------------------------------------------------------
// State machine helpers
// ---------------------------------------------------------------------------

// executeOperation drives the operation through the state machine.
func (p *Processor) executeOperation(ctx context.Context, tenantID string, op *models.JobOperation) (*models.JobOperation, error) {
	// pending → running
	if !p.canTransition(op.Status, models.StatusRunning) {
		err := fmt.Errorf("%w: %s → %s", ErrInvalidTransition, op.Status, models.StatusRunning)
		return op, err
	}
	if err := p.repo.UpdateStatus(ctx, tenantID, op.ID, models.StatusRunning, "", ""); err != nil {
		return op, err
	}
	op.Status = models.StatusRunning

	p.logger.Info("job operation running",
		zap.String("id", op.ID),
		zap.String("type", op.Type),
		zap.String("target", op.Target),
		zap.String("tenantID", tenantID),
	)

	// Execute — dispatch to concrete action via executor or built-in handler
	result, err := p.runOperation(ctx, tenantID, op)

	// running → completed or failed
	status := models.StatusCompleted
	if err != nil {
		status = models.StatusFailed
	}
	if err := p.repo.UpdateStatus(ctx, tenantID, op.ID, status, result, errString(err)); err != nil {
		p.logger.Error("failed to finalize operation",
			zap.String("id", op.ID),
			zap.String("status", status),
			zap.Error(err),
		)
	}
	op.Status = status

	p.logger.Info("job operation finished",
		zap.String("id", op.ID),
		zap.String("status", status),
		zap.Error(err),
	)

	return op, err
}

// runOperation dispatches the operation to its concrete implementation.
// Each operation type maps to a handler that performs the work.
func (p *Processor) runOperation(ctx context.Context, tenantID string, op *models.JobOperation) (string, error) {
	handler := p.operationHandler(op.Type)
	if handler == nil {
		return "", fmt.Errorf("no handler for operation type: %s", op.Type)
	}
	return handler(ctx, tenantID, op)
}

// operationHandler returns the handler function for a given operation type.
func (p *Processor) operationHandler(opType string) func(context.Context, string, *models.JobOperation) (string, error) {
	switch opType {
	case models.TypeCreate:
		return p.handleCreate
	case models.TypeUpdate:
		return p.handleUpdate
	case models.TypeDelete:
		return p.handleDelete
	case models.TypeRun:
		return p.handleRun
	case models.TypePause:
		return p.handlePause
	case models.TypeResume:
		return p.handleResume
	case models.TypeCancel:
		return p.handleCancel
	default:
		return nil
	}
}

// ---------------------------------------------------------------------------
// Built-in operation handlers
// ---------------------------------------------------------------------------

func (p *Processor) handleCreate(ctx context.Context, tenantID string, op *models.JobOperation) (string, error) {
	var params map[string]string
	if op.Params != "" {
		if err := json.Unmarshal([]byte(op.Params), &params); err != nil {
			return "", fmt.Errorf("invalid create params: %w", err)
		}
	}
	if len(params) == 0 {
		return "", errors.New("create operation requires non-empty params")
	}

	paramsJSON := "{}"
	if b, err := json.Marshal(params); err == nil {
		paramsJSON = string(b)
	}

	newOp := &models.JobOperation{
		TenantID: tenantID,
		Type:     models.TypeCreate,
		Target:   op.Target,
		Params:   paramsJSON,
		Status:   models.StatusCompleted,
	}
	if err := p.repo.CreateOperation(ctx, newOp); err != nil {
		return "", fmt.Errorf("failed to create job resource: %w", err)
	}

	result := map[string]any{"created_id": newOp.ID, "target": op.Target}
	b, _ := json.Marshal(result)
	return string(b), nil
}

func (p *Processor) handleUpdate(ctx context.Context, tenantID string, op *models.JobOperation) (string, error) {
	if op.Target == "" {
		return "", errors.New("update operation requires a target ID")
	}

	var params map[string]interface{}
	if op.Params != "" {
		if err := json.Unmarshal([]byte(op.Params), &params); err != nil {
			return "", fmt.Errorf("invalid update params: %w", err)
		}
	}
	if len(params) == 0 {
		return "", errors.New("update operation requires non-empty params")
	}

	targetOp, err := p.repo.GetOperation(ctx, tenantID, op.Target)
	if err != nil {
		return "", fmt.Errorf("failed to get target operation: %w", err)
	}

	status := targetOp.Status
	if s, ok := params["status"]; ok {
		if sv, ok2 := s.(string); ok2 {
			status = sv
		}
		delete(params, "status")
	}

	paramsJSON := "{}"
	if b, err := json.Marshal(params); err == nil {
		paramsJSON = string(b)
	}

	if err := p.repo.UpdateStatus(ctx, tenantID, op.Target, status, paramsJSON, ""); err != nil {
		return "", fmt.Errorf("failed to update job: %w", err)
	}

	result := map[string]any{"updated_id": op.Target, "status": status, "fields": params}
	b, _ := json.Marshal(result)
	return string(b), nil
}

func (p *Processor) handleDelete(ctx context.Context, tenantID string, op *models.JobOperation) (string, error) {
	if op.Target == "" {
		return "", errors.New("delete operation requires a target ID")
	}

	if err := p.repo.UpdateStatus(ctx, tenantID, op.Target, models.StatusCancelled, "", "soft-deleted"); err != nil {
		return "", fmt.Errorf("failed to delete job: %w", err)
	}

	result := map[string]any{"deleted_id": op.Target, "action": "soft-delete"}
	b, _ := json.Marshal(result)
	return string(b), nil
}

func (p *Processor) handleRun(ctx context.Context, tenantID string, op *models.JobOperation) (string, error) {
	if op.Target == "" {
		return "", errors.New("run operation requires a target ID")
	}

	if err := p.repo.UpdateStatus(ctx, tenantID, op.Target, models.StatusRunning, "", ""); err != nil {
		return "", fmt.Errorf("failed to run job: %w", err)
	}

	result := map[string]any{"run_id": op.Target, "status": models.StatusRunning}
	b, _ := json.Marshal(result)
	return string(b), nil
}

func (p *Processor) handlePause(ctx context.Context, tenantID string, op *models.JobOperation) (string, error) {
	if op.Target == "" {
		return "", errors.New("pause operation requires a target ID")
	}

	if err := p.repo.UpdateStatus(ctx, tenantID, op.Target, models.StatusPaused, "", ""); err != nil {
		return "", fmt.Errorf("failed to pause job: %w", err)
	}

	result := map[string]any{"paused_id": op.Target, "status": models.StatusPaused}
	b, _ := json.Marshal(result)
	return string(b), nil
}

func (p *Processor) handleResume(ctx context.Context, tenantID string, op *models.JobOperation) (string, error) {
	if op.Target == "" {
		return "", errors.New("resume operation requires a target ID")
	}

	if err := p.repo.UpdateStatus(ctx, tenantID, op.Target, models.StatusPending, "", ""); err != nil {
		return "", fmt.Errorf("failed to resume job: %w", err)
	}

	result := map[string]any{"resumed_id": op.Target, "status": models.StatusPending}
	b, _ := json.Marshal(result)
	return string(b), nil
}

func (p *Processor) handleCancel(ctx context.Context, tenantID string, op *models.JobOperation) (string, error) {
	if op.Target == "" {
		return "", errors.New("cancel operation requires a target ID")
	}

	if err := p.repo.UpdateStatus(ctx, tenantID, op.Target, models.StatusCancelled, "", "cancelled"); err != nil {
		return "", fmt.Errorf("failed to cancel job: %w", err)
	}

	result := map[string]any{"cancelled_id": op.Target, "status": models.StatusCancelled}
	b, _ := json.Marshal(result)
	return string(b), nil
}

// ---------------------------------------------------------------------------
// Status / chain helpers
// ---------------------------------------------------------------------------

// canTransition checks whether a status transition is allowed by the state machine.
func (p *Processor) canTransition(from, to string) bool {
	return validTransitions[fmt.Sprintf("%s:%s", from, to)]
}

// updateChainStatus updates the chain status based on the operations it contains.
func (p *Processor) updateChainStatus(ctx context.Context, tenantID, chainID string, chainErr error) error {
	opsResp, err := p.repo.ListOperations(ctx, tenantID, chainID, 100, 0)
	if err != nil {
		return err
	}
	status := models.StatusCompleted
	if chainErr != nil {
		status = models.StatusFailed
		_, err = p.repo.UpdateChain(ctx, tenantID, chainID, map[string]interface{}{
			"status": status,
			"error":  chainErr.Error(),
		})
		return err
	}
	// Determine from operations
	for _, op := range opsResp.Data {
		if op.Status == models.StatusFailed {
			status = models.StatusFailed
			break
		}
		if op.Status == models.StatusRunning || op.Status == models.StatusPending {
			status = models.StatusRunning
		}
	}
	if status == models.StatusPending {
		// No operations yet
		return nil
	}
	_, err = p.repo.UpdateChain(ctx, tenantID, chainID, map[string]interface{}{
		"status": status,
	})
	return err
}

// markChainCancelled cancels a chain.
func (p *Processor) markChainCancelled(ctx context.Context, tenantID, chainID string) {
	if _, err := p.repo.UpdateChain(ctx, tenantID, chainID, map[string]interface{}{
		"status": models.StatusCancelled,
		"error":  "chain cancelled",
	}); err != nil {
		p.logger.Warn("failed to mark chain cancelled",
			zap.String("chainID", chainID),
			zap.Error(err),
		)
	}
}

// isValidOperationType checks whether an operation type is supported.
func isValidOperationType(t string) bool {
	for _, typ := range models.AllOperationTypes {
		if typ == t {
			return true
		}
	}
	return false
}

// errString returns a safe string for an error (empty string for nil).
func errString(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}
