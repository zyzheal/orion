package handlers

import (
	"context"
	"errors"
	"time"

	"go.uber.org/zap"

	"orion/platform-svc-go/internal/execution-mode-engine/engine"
)

// ErrSchedulerNotConfigured is returned when the scheduled handler is used
// without a Scheduler implementation.
var ErrSchedulerNotConfigured = errors.New("scheduled handler: scheduler not configured")

// Scheduler is the interface that a handler uses to schedule requests for
// future execution. Implementations typically wrap cron-based schedulers or
// a job store that a background runner polls.
type Scheduler interface {
	Schedule(ctx context.Context, req *engine.ExecutionRequest) error
}

// ScheduledHandler schedules requests for future execution. If the request's
// ScheduledAt field is zero, the handler rejects it as invalid.
//
// Usage:
//   handler := handlers.NewScheduledHandler(logger, scheduler)
//   engineInstance.RegisterHandler(handler)
type ScheduledHandler struct {
	logger    *zap.Logger
	scheduler Scheduler
	stats     *engine.HandlerStats

	// minScheduleDelay is the minimum time that must elapse before a scheduled
	// request is allowed to run. Zero disables the guard.
	minScheduleDelay time.Duration
}

// ScheduledHandlerOptions holds optional parameters for NewScheduledHandler.
type ScheduledHandlerOptions struct {
	// MinScheduleDelay enforces a minimum delay between now and the scheduled
	// time. Used to reject requests that are scheduled too close to "now"
	// (which should use immediate execution instead).
	MinScheduleDelay time.Duration
}

// NewScheduledHandler creates a ScheduledHandler backed by the provided
// scheduler. An optional options struct may be passed to tune behaviour.
func NewScheduledHandler(logger *zap.Logger, scheduler Scheduler, opts ...ScheduledHandlerOptions) *ScheduledHandler {
	cfg := ScheduledHandlerOptions{}
	if len(opts) > 0 {
		cfg = opts[0]
	}
	if logger == nil {
		logger = zap.NewNop()
	}
	return &ScheduledHandler{
		logger:           logger,
		scheduler:        scheduler,
		stats:            &engine.HandlerStats{Name: "scheduled"},
		minScheduleDelay: cfg.MinScheduleDelay,
	}
}

func (h *ScheduledHandler) Name() string {
	return "scheduled"
}

func (h *ScheduledHandler) Handles(mode engine.Mode) bool {
	return mode == engine.ModeScheduled
}

// Handle schedules the request and returns a scheduled status.
func (h *ScheduledHandler) Handle(ctx context.Context, req *engine.ExecutionRequest) (*engine.ExecutionResult, error) {
	start := time.Now()
	h.stats.TotalCalls++

	result := &engine.ExecutionResult{
		Mode:       engine.ModeScheduled,
		Duration:   time.Since(start),
		ExecutedAt: time.Now().UTC(),
	}

	if h.scheduler == nil {
		result.RequestID = req.ID
		result.Status = engine.StatusFailed
		result.Error = ErrSchedulerNotConfigured.Error()
		h.stats.FailedCalls++
		return result, ErrSchedulerNotConfigured
	}

	// Validate scheduled time.
	if req.ScheduledAt.IsZero() {
		result.RequestID = req.ID
		result.Status = engine.StatusRejected
		result.Error = "scheduled time is not set"
		h.stats.FailedCalls++
		return result, errors.New("scheduled handler: ScheduledAt is not set")
	}

	scheduledAt := req.ScheduledAt.UTC()
	now := time.Now().UTC()
	if scheduledAt.Before(now) {
		result.RequestID = req.ID
		result.Status = engine.StatusRejected
		result.Error = "scheduled time is in the past"
		h.logger.Warn("scheduled handler: rejected past timestamp",
			zap.String("request_id", req.ID),
			zap.Time("scheduled_at", scheduledAt),
		)
		h.stats.FailedCalls++
		return result, errors.New("scheduled handler: scheduled time is in the past")
	}

	if h.minScheduleDelay > 0 {
		delta := scheduledAt.Sub(now)
		if delta < h.minScheduleDelay {
			result.RequestID = req.ID
			result.Status = engine.StatusRejected
			result.Error = "scheduled time is too close to now"
			h.logger.Warn("scheduled handler: rejected short delay",
				zap.String("request_id", req.ID),
				zap.Duration("delta", delta),
				zap.Duration("min_delay", h.minScheduleDelay),
			)
			h.stats.FailedCalls++
			return result, errors.New("scheduled handler: scheduled time is too close to now")
		}
	}

	if req.ID == "" {
		result.Status = engine.StatusRejected
		result.Error = "request ID is required for scheduling"
		h.stats.FailedCalls++
		return result, errors.New("scheduled handler: request ID is required")
	}

	result.RequestID = req.ID

	h.logger.Info("scheduled handler: scheduling request",
		zap.String("request_id", req.ID),
		zap.Time("scheduled_at", scheduledAt),
		zap.String("tenant_id", req.TenantID),
	)

	err := h.scheduler.Schedule(ctx, req)
	result.Duration = time.Since(start)

	if err != nil {
		result.Status = engine.StatusFailed
		result.Error = err.Error()
		h.stats.FailedCalls++
		h.logger.Error("scheduled handler: schedule failed",
			zap.String("request_id", req.ID),
			zap.Duration("duration", result.Duration),
			zap.Error(err),
		)
		return result, err
	}

	result.Status = engine.StatusScheduled
	result.Output = map[string]interface{}{
		"scheduled_at": scheduledAt.Format(time.RFC3339),
	}
	h.stats.SuccessCalls++
	h.stats.LastExecuted = time.Now().UTC()
	h.logger.Info("scheduled handler: request scheduled",
		zap.String("request_id", req.ID),
		zap.Time("scheduled_at", scheduledAt),
		zap.Duration("duration", result.Duration),
	)
	return result, nil
}
