package handlers

import (
	"context"
	"time"

	"go.uber.org/zap"

	"orion/platform-svc-go/internal/execution-mode-engine/engine"
)

// Queue is the interface that a handler uses to enqueue requests for async
// processing. Implementations typically wrap a message broker (NATS, Redis
// Stream, Kafka) or an in-memory channel.
type Queue interface {
	Enqueue(ctx context.Context, req *engine.ExecutionRequest) error
}

// QueuedHandler enqueues requests for asynchronous processing. It returns
// immediately with a StatusQueued result. The actual execution is performed
// by a separate worker consuming from the queue.
//
// Usage:
//   handler := handlers.NewQueuedHandler(logger, queue)
//   engineInstance.RegisterHandler(handler)
type QueuedHandler struct {
	logger *zap.Logger
	queue  Queue
	stats  *engine.HandlerStats
}

// NewQueuedHandler creates a QueuedHandler backed by the provided queue.
func NewQueuedHandler(logger *zap.Logger, queue Queue) *QueuedHandler {
	if logger == nil {
		logger = zap.NewNop()
	}
	return &QueuedHandler{
		logger: logger,
		queue:  queue,
		stats:  &engine.HandlerStats{Name: "queued"},
	}
}

func (h *QueuedHandler) Name() string {
	return "queued"
}

func (h *QueuedHandler) Handles(mode engine.Mode) bool {
	return mode == engine.ModeQueued
}

// Handle enqueues the request and returns a queued status.
func (h *QueuedHandler) Handle(ctx context.Context, req *engine.ExecutionRequest) (*engine.ExecutionResult, error) {
	start := time.Now()
	h.stats.TotalCalls++

	if h.queue == nil {
		h.logger.Error("queued handler: no queue configured")
		result := &engine.ExecutionResult{
			RequestID: req.ID,
			Mode:      engine.ModeQueued,
			Status:    engine.StatusFailed,
			Error:     "queue not configured",
			Duration:  time.Since(start),
			ExecutedAt: time.Now().UTC(),
		}
		h.stats.FailedCalls++
		return result, engine.ErrModeNotImplemented
	}

	h.logger.Info("queued handler: enqueueing request",
		zap.String("request_id", req.ID),
		zap.String("tenant_id", req.TenantID),
	)

	err := h.queue.Enqueue(ctx, req)
	duration := time.Since(start)

	result := &engine.ExecutionResult{
		RequestID: req.ID,
		Mode:      engine.ModeQueued,
		Status:    engine.StatusQueued,
		Duration:  duration,
		ExecutedAt: time.Now().UTC(),
		Output:    map[string]interface{}{"enqueued": true},
	}

	if err != nil {
		result.Status = engine.StatusFailed
		result.Error = err.Error()
		h.stats.FailedCalls++
		h.logger.Error("queued handler: enqueue failed",
			zap.String("request_id", req.ID),
			zap.Duration("duration", duration),
			zap.Error(err),
		)
		return result, err
	}

	h.stats.SuccessCalls++
	h.stats.LastExecuted = time.Now().UTC()
	h.logger.Info("queued handler: request enqueued",
		zap.String("request_id", req.ID),
		zap.Duration("duration", duration),
	)
	return result, nil
}
