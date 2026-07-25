package handlers

import (
	"context"
	"errors"
	"time"

	"go.uber.org/zap"

	"orion/platform-svc-go/internal/execution-mode-engine/engine"
)

// ConfirmationChecker is called by the manual handler to determine whether
// the request has received explicit user approval before execution.
type ConfirmationChecker interface {
	// IsConfirmed returns true if the request has been confirmed for the given
	// tenant.
	IsConfirmed(ctx context.Context, requestID string, tenantID string) (bool, error)
	// RecordPending registers the request as awaiting confirmation.
	RecordPending(ctx context.Context, requestID string, tenantID string) error
}

// ErrConfirmationRequired is returned when a manual request has not been
// confirmed.
var ErrConfirmationRequired = errors.New("manual handler: confirmation required")

// ManualHandler executes requests only after an external confirmation step.
// It delegates the actual work to an Executor (the same interface used by
// ImmediateHandler) and uses a ConfirmationChecker to gate execution.
//
// Usage:
//   handler := handlers.NewManualHandler(logger, executor, checker)
//   engineInstance.RegisterHandler(handler)
type ManualHandler struct {
	logger  *zap.Logger
	executor Executor
	checker  ConfirmationChecker
	stats    *engine.HandlerStats
}

// ManualHandlerOptions holds optional parameters for NewManualHandler.
type ManualHandlerOptions struct {
	// SkipConfirmation causes the handler to execute immediately without
	// checking for confirmation. Useful for testing.
	SkipConfirmation bool
}

// NewManualHandler creates a new ManualHandler.
func NewManualHandler(logger *zap.Logger, executor Executor, checker ConfirmationChecker, opts ...ManualHandlerOptions) *ManualHandler {
	_ = opts
	if logger == nil {
		logger = zap.NewNop()
	}
	return &ManualHandler{
		logger:  logger,
		executor: executor,
		checker:  checker,
		stats:   &engine.HandlerStats{Name: "manual"},
	}
}

func (h *ManualHandler) Name() string {
	return "manual"
}

func (h *ManualHandler) Handles(mode engine.Mode) bool {
	return mode == engine.ModeManual
}

// Handle executes the request after verifying confirmation.
func (h *ManualHandler) Handle(ctx context.Context, req *engine.ExecutionRequest) (*engine.ExecutionResult, error) {
	start := time.Now()
	h.stats.TotalCalls++

	result := &engine.ExecutionResult{
		RequestID: req.ID,
		Mode:      engine.ModeManual,
		ExecutedAt: time.Now().UTC(),
	}

	// Confirmation gate.
	if h.checker != nil {
		confirmed, err := h.checker.IsConfirmed(ctx, req.ID, req.TenantID)
		if err != nil {
			result.Status = engine.StatusFailed
			result.Error = "failed to check confirmation: " + err.Error()
			result.Duration = time.Since(start)
			h.stats.FailedCalls++
			return result, err
		}
		if !confirmed {
			// Register as pending so downstream consumers can poll status.
			_ = h.checker.RecordPending(ctx, req.ID, req.TenantID)

			result.Status = engine.StatusRejected
			result.Error = ErrConfirmationRequired.Error()
			result.Duration = time.Since(start)
			h.logger.Info("manual handler: confirmation pending",
				zap.String("request_id", req.ID),
				zap.String("tenant_id", req.TenantID),
			)
			h.stats.FailedCalls++
			return result, ErrConfirmationRequired
		}
	}

	h.logger.Info("manual handler: executing confirmed request",
		zap.String("request_id", req.ID),
		zap.String("tenant_id", req.TenantID),
	)

	output, err := h.executor.Execute(ctx, req)
	duration := time.Since(start)
	result.Duration = duration
	result.Output = output

	if err != nil {
		result.Status = engine.StatusFailed
		result.Error = err.Error()
		h.stats.FailedCalls++
		h.logger.Error("manual handler: execution failed",
			zap.String("request_id", req.ID),
			zap.Duration("duration", duration),
			zap.Error(err),
		)
		return result, err
	}

	if ctx.Err() != nil {
		result.Status = engine.StatusTimeout
		result.Error = "request timed out"
		return result, ctx.Err()
	}

	result.Status = engine.StatusSuccess
	h.stats.SuccessCalls++
	h.stats.LastExecuted = time.Now().UTC()
	h.logger.Info("manual handler: execution succeeded",
		zap.String("request_id", req.ID),
		zap.Duration("duration", duration),
	)
	return result, nil
}
