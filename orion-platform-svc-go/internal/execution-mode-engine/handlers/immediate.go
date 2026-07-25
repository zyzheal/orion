package handlers

import (
	"context"
	"time"

	"go.uber.org/zap"

	"orion/platform-svc-go/internal/execution-mode-engine/engine"
)

// ImmediateHandler executes requests synchronously in the caller's goroutine.
// It is the simplest handler and is suitable for short-lived, idempotent work.
//
// Usage:
//   handler := handlers.NewImmediateHandler(logger, executor)
//   engineInstance.RegisterHandler(handler)
type ImmediateHandler struct {
	logger    *zap.Logger
	executor  Executor
	stats     *engine.HandlerStats
	timeout   time.Duration
}

// Executor abstracts the actual work to be performed. The ImmediateHandler
// delegates to this interface so that callers can provide arbitrary execution
// logic without coupling to the handler.
type Executor interface {
	Execute(ctx context.Context, req *engine.ExecutionRequest) (map[string]interface{}, error)
}

// ImmediateHandlerOptions holds optional parameters for NewImmediateHandler.
type ImmediateHandlerOptions struct {
	// Timeout overrides the per-request timeout for immediate executions.
	// Zero means no additional timeout (use request's own timeout).
	Timeout time.Duration
}

// NewImmediateHandler creates a new ImmediateHandler with the given logger and
// executor. An optional options struct may be passed to tune behaviour.
func NewImmediateHandler(logger *zap.Logger, executor Executor, opts ...ImmediateHandlerOptions) *ImmediateHandler {
	cfg := ImmediateHandlerOptions{}
	if len(opts) > 0 {
		cfg = opts[0]
	}
	if logger == nil {
		logger = zap.NewNop()
	}
	return &ImmediateHandler{
		logger:  logger,
		executor: executor,
		stats:   &engine.HandlerStats{Name: "immediate"},
		timeout: cfg.Timeout,
	}
}

func (h *ImmediateHandler) Name() string {
	return "immediate"
}

func (h *ImmediateHandler) Handles(mode engine.Mode) bool {
	return mode == engine.ModeImmediate
}

// Handle runs the request synchronously and returns an ExecutionResult.
func (h *ImmediateHandler) Handle(ctx context.Context, req *engine.ExecutionRequest) (*engine.ExecutionResult, error) {
	start := time.Now()
	h.stats.TotalCalls++

	// Apply handler-level timeout if configured.
	execCtx := ctx
	if h.timeout > 0 {
		var cancel context.CancelFunc
		execCtx, cancel = context.WithTimeout(ctx, h.timeout)
		defer cancel()
	}

	h.logger.Info("immediate handler: executing",
		zap.String("request_id", req.ID),
		zap.String("tenant_id", req.TenantID),
	)

	output, err := h.executor.Execute(execCtx, req)

	duration := time.Since(start)
	result := &engine.ExecutionResult{
		RequestID: req.ID,
		Mode:      engine.ModeImmediate,
		Duration:  duration,
		ExecutedAt: time.Now().UTC(),
		Output:    output,
	}

	if err != nil {
		result.Status = engine.StatusFailed
		result.Error = err.Error()
		h.stats.FailedCalls++
		h.logger.Error("immediate handler: execution failed",
			zap.String("request_id", req.ID),
			zap.Duration("duration", duration),
			zap.Error(err),
		)
		return result, err
	}

	// Check for context cancellation / timeout.
	if execCtx.Err() != nil {
		result.Status = engine.StatusTimeout
		result.Error = "request timed out"
		return result, execCtx.Err()
	}

	result.Status = engine.StatusSuccess
	h.stats.SuccessCalls++
	h.stats.LastExecuted = time.Now().UTC()
	h.logger.Info("immediate handler: execution succeeded",
		zap.String("request_id", req.ID),
		zap.Duration("duration", duration),
	)
	return result, nil
}
