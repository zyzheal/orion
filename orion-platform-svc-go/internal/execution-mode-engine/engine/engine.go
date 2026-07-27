package engine

import (
	"context"
	"errors"
	"fmt"
	"time"

	"go.uber.org/zap"
)

// Mode identifies how an execution request should be dispatched.
type Mode string

const (
	ModeImmediate  Mode = "immediate"     // execute synchronously, blocking the caller
	ModeQueued     Mode = "queued"        // enqueue for async processing by a worker
	ModeScheduled  Mode = "scheduled"     // schedule for a future time
	ModeManual     Mode = "manual"        // require explicit user confirmation before running
	ModeAPITriggered Mode = "api-triggered" // triggered by an external API call / webhook
)

// IsValid returns true if the mode is one of the supported execution modes.
func (m Mode) IsValid() bool {
	switch m {
	case ModeImmediate, ModeQueued, ModeScheduled, ModeManual, ModeAPITriggered:
		return true
	}
	return false
}

// String returns the canonical string representation of the mode.
func (m Mode) String() string {
	return string(m)
}

var (
	// ErrUnknownMode is returned when the router cannot resolve the execution mode.
	ErrUnknownMode = errors.New("execution-mode-engine: unknown execution mode")

	// ErrModeNotImplemented is returned when a mode has no registered handler.
	ErrModeNotImplemented = errors.New("execution-mode-engine: mode handler not implemented")

	// ErrFallbackExhausted is returned when all configured fallbacks have been tried.
	ErrFallbackExhausted = errors.New("execution-mode-engine: all fallback modes exhausted")
)

// ExecutionRequest describes a single unit of work to be executed.
type ExecutionRequest struct {
	ID         string
	Name       string
	TenantID   string
	Mode       Mode
	Payload    map[string]interface{}
	ScheduledAt time.Time
	Timeout    time.Duration
	RetryMax   int
	TriggeredBy string // user, cron, webhook, etc.
}

// ExecutionResult describes the outcome of an execution.
type ExecutionResult struct {
	RequestID string
	Mode      Mode
	Status    ExecutionStatus
	Output    map[string]interface{}
	Error     string
	Duration  time.Duration
	ExecutedAt time.Time
}

// ExecutionStatus indicates the status of an execution.
type ExecutionStatus string

const (
	StatusSuccess    ExecutionStatus = "success"
	StatusFailed     ExecutionStatus = "failed"
	StatusRejected   ExecutionStatus = "rejected"
	StatusQueued     ExecutionStatus = "queued"
	StatusScheduled  ExecutionStatus = "scheduled"
	StatusCancelled  ExecutionStatus = "cancelled"
	StatusTimeout    ExecutionStatus = "timeout"
)

// ModeHandler is the interface that every mode-specific handler must implement.
// The engine dispatches requests to the appropriate handler based on the
// request's Mode field, resolved via the ModeRouter.
type ModeHandler interface {
	// Name returns the canonical name of the handler.
	Name() string

	// Handles returns true if this handler supports the given mode.
	Handles(Mode) bool

	// Handle executes the request using this handler's strategy.
	Handle(ctx context.Context, req *ExecutionRequest) (*ExecutionResult, error)
}

// ModeRouter resolves an ExecutionRequest's mode to the best available
// ModeHandler, supporting fallback chains.
type ModeRouter interface {
	// Route resolves the mode for the given request to a handler.
	// If no handler matches, returns (nil, ErrModeNotImplemented).
	Route(req *ExecutionRequest) (ModeHandler, error)

	// FallbackModes returns the ordered fallback modes that will be tried
	// when the primary handler fails, up to maxAttempts times.
	FallbackModes(req *ExecutionRequest) []Mode

	// RegisterModeHandler registers a handler. The handler's supported mode
	// (returned by Handles) is used as the primary key.
	RegisterModeHandler(h ModeHandler)
}

// Engine is the facade for execution-mode dispatch.
// It receives ExecutionRequest objects, resolves the appropriate handler via
// the ModeRouter, executes the request, and returns the result.
//
// The engine supports:
//   - mode fallback (try alternative modes when primary fails)
//   - per-request retries
//   - structured logging via zap
//   - context-aware cancellation and timeout
type Engine struct {
	router *routerImpl
	logger *zap.Logger
	cfg    Config
}

// Config holds tuning parameters for the Engine.
type Config struct {
	// DefaultTimeout is applied to requests that do not specify a timeout.
	DefaultTimeout time.Duration

	// DefaultRetryMax is the retry count when ExecutionRequest.RetryMax is zero.
	DefaultRetryMax int

	// EnableFallback enables automatic mode fallback on handler error.
	EnableFallback bool

	// FallbackDelay is the wait period before attempting a fallback mode.
	// Useful to avoid hammering a degraded handler.
	FallbackDelay time.Duration
}

func (c *Config) defaults() {
	if c.DefaultTimeout <= 0 {
		c.DefaultTimeout = 5 * time.Minute
	}
	if c.DefaultRetryMax < 0 {
		c.DefaultRetryMax = 0
	}
	if c.FallbackDelay <= 0 {
		c.FallbackDelay = time.Second
	}
}

// NewEngine creates a new Engine with the given config and logger.
// If logger is nil, a no-op logger is used.
func NewEngine(cfg Config, logger *zap.Logger) *Engine {
	cfg.defaults()
	if logger == nil {
		logger = zap.NewNop()
	}
	return &Engine{
		router: newRouterImpl(logger),
		logger: logger,
		cfg:    cfg,
	}
}

// RegisterHandler registers a mode handler with the engine's router.
// All handler implementations must call this (or Engine.AddModeHandler) during
// initialisation so that the router can dispatch requests to them.
func (e *Engine) RegisterHandler(h ModeHandler) {
	e.router.RegisterModeHandler(h)
	e.logger.Info("execution-mode handler registered",
		zap.String("handler", h.Name()),
		zap.String("mode", e.modeForHandler(h).String()),
	)
}

// Execute dispatches the request through the appropriate mode handler.
//
// Execution flow:
//   1. Resolve tenant from context (falls back to "system").
//   2. Apply timeout if not set.
//   3. Route to the primary handler.
//   4. Execute with configured retries.
//   5. On failure, optionally try fallback modes.
//   6. Return the final ExecutionResult.
func (e *Engine) Execute(ctx context.Context, req *ExecutionRequest) (*ExecutionResult, error) {
	if req == nil {
		return nil, fmt.Errorf("execution-mode-engine: request is nil")
	}
	if !req.Mode.IsValid() {
		return nil, fmt.Errorf("%w: %q", ErrUnknownMode, req.Mode)
	}

	// Resolve tenant from context.
	tenantID := req.TenantID
	if tenantID == "" {
		if t, ok := ctx.Value("tenant_id").(string); ok && t != "" {
			tenantID = t
		} else {
			tenantID = "system"
		}
		req.TenantID = tenantID
	}

	// Apply timeout if not set.
	execCtx := ctx
	if req.Timeout <= 0 {
		var cancel context.CancelFunc
		execCtx, cancel = context.WithTimeout(ctx, e.cfg.DefaultTimeout)
		defer cancel()
	} else if ctx.Err() == nil {
		// Only override if the parent context has no deadline.
		var cancel context.CancelFunc
		execCtx, cancel = context.WithTimeout(ctx, req.Timeout)
		defer cancel()
	}

	e.logger.Info("execution-mode-engine: dispatching",
		zap.String("request_id", req.ID),
		zap.String("name", req.Name),
		zap.String("mode", req.Mode.String()),
		zap.String("tenant_id", tenantID),
		zap.Int("retry_max", e.resolveRetryMax(req)),
	)

	// Route to primary handler.
	handler, err := e.router.Route(req)
	if err != nil {
		if !e.cfg.EnableFallback {
			return nil, err
		}
		// Try fallback modes.
		return e.executeWithFallback(execCtx, req)
	}

	// Execute with retries.
	result, err := e.executeWithRetry(execCtx, req, handler)
	if err == nil {
		return result, nil
	}

	// On failure, try fallback modes.
	if e.cfg.EnableFallback {
		return e.executeWithFallback(execCtx, req)
	}

	return result, err
}

// executeWithRetry runs the handler up to RetryMax times.
func (e *Engine) executeWithRetry(ctx context.Context, req *ExecutionRequest, handler ModeHandler) (*ExecutionResult, error) {
	retryMax := e.resolveRetryMax(req)
	var lastErr error
	var lastResult *ExecutionResult

	for attempt := 0; attempt <= retryMax; attempt++ {
		result, err := handler.Handle(ctx, req)
		if err == nil {
			e.logger.Info("execution-mode-engine: handler succeeded",
				zap.String("request_id", req.ID),
				zap.String("handler", handler.Name()),
				zap.Int("attempt", attempt+1),
			)
			e.router.RecordResult(handler.Name(), true, time.Now())
			return result, nil
		}
		lastErr = err
		lastResult = result
		e.router.RecordResult(handler.Name(), false, time.Now())
		if attempt < retryMax {
			e.logger.Warn("execution-mode-engine: handler attempt failed, retrying",
				zap.String("request_id", req.ID),
				zap.String("handler", handler.Name()),
				zap.Int("attempt", attempt+1),
				zap.Error(err),
			)
		}
	}

	e.logger.Error("execution-mode-engine: all retry attempts failed",
		zap.String("request_id", req.ID),
		zap.String("handler", handler.Name()),
		zap.Int("retry_max", retryMax),
		zap.Error(lastErr),
	)
	return lastResult, lastErr
}

// executeWithFallback tries each fallback mode in order until one succeeds.
func (e *Engine) executeWithFallback(ctx context.Context, req *ExecutionRequest) (*ExecutionResult, error) {
	fallbackModes := e.router.FallbackModes(req)
	if len(fallbackModes) == 0 {
		return nil, ErrFallbackExhausted
	}

	var lastErr error
	var lastResult *ExecutionResult

	for _, fallbackMode := range fallbackModes {
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}

		// Build a fallback request with the new mode.
		fallbackReq := &ExecutionRequest{
			ID:          req.ID,
			Name:        req.Name,
			TenantID:    req.TenantID,
			Mode:        fallbackMode,
			Payload:     req.Payload,
			Timeout:     req.Timeout,
			RetryMax:    0, // no nested retries inside fallback
			TriggeredBy: req.TriggeredBy,
		}

		handler, err := e.router.Route(fallbackReq)
		if err != nil {
			e.logger.Debug("fallback mode not available",
				zap.String("mode", fallbackMode.String()),
				zap.Error(err),
			)
			continue
		}

		e.logger.Info("execution-mode-engine: trying fallback mode",
			zap.String("request_id", req.ID),
			zap.String("fallback_mode", fallbackMode.String()),
			zap.String("handler", handler.Name()),
		)

		result, err := handler.Handle(ctx, fallbackReq)
		if err == nil {
			e.logger.Info("execution-mode-engine: fallback succeeded",
				zap.String("request_id", req.ID),
				zap.String("fallback_mode", fallbackMode.String()),
			)
			e.router.RecordResult(handler.Name(), true, time.Now())
			return result, nil
		}
		lastErr = err
		lastResult = result
		e.router.RecordResult(handler.Name(), false, time.Now())

		// Brief delay before the next fallback attempt.
		if fallbackReq.Timeout > 0 || e.cfg.FallbackDelay > 0 {
			delay := e.cfg.FallbackDelay
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(delay):
			}
		}
	}

	e.logger.Error("execution-mode-engine: fallback exhausted",
		zap.String("request_id", req.ID),
		zap.Error(lastErr),
	)
	return lastResult, ErrFallbackExhausted
}

// resolveRetryMax returns the effective retry count for a request.
func (e *Engine) resolveRetryMax(req *ExecutionRequest) int {
	if req.RetryMax >= 0 {
		return req.RetryMax
	}
	return e.cfg.DefaultRetryMax
}

// modeForHandler returns the first valid mode that the handler handles.
func (e *Engine) modeForHandler(h ModeHandler) Mode {
	for _, m := range []Mode{ModeImmediate, ModeQueued, ModeScheduled, ModeManual, ModeAPITriggered} {
		if h.Handles(m) {
			return m
		}
	}
	return ""
}

// RegisteredModes returns all modes that have at least one handler.
func (e *Engine) RegisteredModes() []Mode {
	return e.router.RegisteredModes()
}

// Stats returns a snapshot of handler-level statistics.
func (e *Engine) Stats() map[string]*HandlerStats {
	return e.router.Stats()
}

// HandlerStats tracks runtime counters for a single handler.
type HandlerStats struct {
	Name         string
	TotalCalls   int64
	SuccessCalls int64
	FailedCalls  int64
	LastExecuted time.Time
}
