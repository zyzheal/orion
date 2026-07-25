package handlers

import (
	"context"
	"errors"
	"time"

	"go.uber.org/zap"

	"orion/platform-svc-go/internal/execution-mode-engine/engine"
)

// ErrAPITriggerMissing is returned when the request lacks a required trigger
// identifier for api-triggered execution.
var ErrAPITriggerMissing = errors.New("api-triggered handler: trigger identifier missing")

// APITokenVerifier is called by the api-triggered handler to validate that the
// incoming API call carries a valid token or credential.
type APITokenVerifier interface {
	// Verify returns nil if the provided token is valid for the given tenant.
	Verify(ctx context.Context, token string, tenantID string) error
}

// APITriggeredHandler executes requests that originated from an external API
// call or webhook. It validates the trigger credentials (if a verifier is
// provided) and delegates the actual work to an Executor.
//
// Usage:
//   handler := handlers.NewAPITriggeredHandler(logger, executor, verifier)
//   engineInstance.RegisterHandler(handler)
type APITriggeredHandler struct {
	logger   *zap.Logger
	executor Executor
	verifier APITokenVerifier
	stats    *engine.HandlerStats
}

// NewAPITriggeredHandler creates a new APITriggeredHandler.
func NewAPITriggeredHandler(logger *zap.Logger, executor Executor, verifier APITokenVerifier) *APITriggeredHandler {
	if logger == nil {
		logger = zap.NewNop()
	}
	return &APITriggeredHandler{
		logger:   logger,
		executor: executor,
		verifier: verifier,
		stats:    &engine.HandlerStats{Name: "api-triggered"},
	}
}

func (h *APITriggeredHandler) Name() string {
	return "api-triggered"
}

func (h *APITriggeredHandler) Handles(mode engine.Mode) bool {
	return mode == engine.ModeAPITriggered
}

// Handle executes the request after validating the API trigger.
func (h *APITriggeredHandler) Handle(ctx context.Context, req *engine.ExecutionRequest) (*engine.ExecutionResult, error) {
	start := time.Now()
	h.stats.TotalCalls++

	result := &engine.ExecutionResult{
		RequestID: req.ID,
		Mode:      engine.ModeAPITriggered,
		ExecutedAt: time.Now().UTC(),
	}

	// Validate that the trigger identifier is present.
	triggeredBy := req.TriggeredBy
	if triggeredBy == "" {
		// Attempt to extract from payload.
		if v, ok := req.Payload["trigger_by"]; ok {
			if s, ok := v.(string); ok {
				triggeredBy = s
			}
		}
		if triggeredBy == "" {
			result.Status = engine.StatusRejected
			result.Error = ErrAPITriggerMissing.Error()
			result.Duration = time.Since(start)
			h.stats.FailedCalls++
			return result, ErrAPITriggerMissing
		}
	}

	// Validate token if a verifier is available.
	token := ""
	if v, ok := req.Payload["token"]; ok {
		if s, ok := v.(string); ok {
			token = s
		}
	}

	if h.verifier != nil && token != "" {
		if err := h.verifier.Verify(ctx, token, req.TenantID); err != nil {
			result.Status = engine.StatusRejected
			result.Error = "api token verification failed: " + err.Error()
			result.Duration = time.Since(start)
			h.stats.FailedCalls++
			h.logger.Warn("api-triggered handler: token verification failed",
				zap.String("request_id", req.ID),
				zap.String("triggered_by", triggeredBy),
				zap.Error(err),
			)
			return result, err
		}
	}

	h.logger.Info("api-triggered handler: executing",
		zap.String("request_id", req.ID),
		zap.String("triggered_by", triggeredBy),
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
		h.logger.Error("api-triggered handler: execution failed",
			zap.String("request_id", req.ID),
			zap.String("triggered_by", triggeredBy),
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
	h.logger.Info("api-triggered handler: execution succeeded",
		zap.String("request_id", req.ID),
		zap.String("triggered_by", triggeredBy),
		zap.Duration("duration", duration),
	)
	return result, nil
}
