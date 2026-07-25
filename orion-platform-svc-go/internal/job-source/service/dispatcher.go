// Package service provides adapters, composition, and dispatch for job sources.
//
// The Dispatcher bridges job source events to downstream processors
// (job-actions executor, job-processor) with typed dispatch, retries,
// and structured logging.
package service

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"orion/platform-svc-go/internal/job-source/models"

	"go.uber.org/zap"
)

// ---------------------------------------------------------------------------
// Dispatcher — routes source events to downstream consumers
// ---------------------------------------------------------------------------

// Dispatcher routes EventPayload records to registered downstream consumers
// (e.g. job-action executor, job-processor). It supports fan-out, retry,
// and structured logging for every dispatch.
type Dispatcher struct {
	consumers map[string][]Consumer // source type -> list of consumers
	mu        sync.RWMutex
	logger    *zap.Logger
	retry     int
	timeout   time.Duration
}

// Consumer is a function that processes a dispatched event.
type Consumer func(ctx context.Context, payload EventPayload) error

// NewDispatcher creates a dispatcher with optional retry and timeout.
func NewDispatcher(logger *zap.Logger, retry int, timeout time.Duration) *Dispatcher {
	d := &Dispatcher{
		consumers: make(map[string][]Consumer),
		logger:    logger,
		retry:     retry,
		timeout:   timeout,
	}
	if d.retry < 0 {
		d.retry = 0
	}
	if d.timeout <= 0 {
		d.timeout = 10 * time.Second
	}
	return d
}

// RegisterConsumer adds a consumer for a source type (fan-out).
func (d *Dispatcher) RegisterConsumer(sourceType string, c Consumer) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.consumers[sourceType] = append(d.consumers[sourceType], c)
	d.logger.Info("consumer registered",
		zap.String("source_type", sourceType),
	)
}

// RemoveConsumer removes a consumer by index for a source type.
func (d *Dispatcher) RemoveConsumer(sourceType string, idx int) bool {
	d.mu.Lock()
	defer d.mu.Unlock()
	consumers, ok := d.consumers[sourceType]
	if !ok || idx < 0 || idx >= len(consumers) {
		return false
	}
	d.consumers[sourceType] = append(consumers[:idx], consumers[idx+1:]...)
	d.logger.Info("consumer removed",
		zap.String("source_type", sourceType),
		zap.Int("idx", idx),
	)
	return true
}

// ListConsumers returns the number of consumers for a source type.
func (d *Dispatcher) ListConsumers(sourceType string) int {
	d.mu.RLock()
	defer d.mu.RUnlock()
	return len(d.consumers[sourceType])
}

// Dispatch sends an event payload to all registered consumers for that
// source type. If no consumers are registered for the type, it attempts
// a wildcard fallback.
func (d *Dispatcher) Dispatch(ctx context.Context, payload EventPayload) error {
	// Optional timeout
	if d.timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, d.timeout)
		defer cancel()
	}

	// Determine target consumers
	var targets []Consumer
	d.mu.RLock()
	targets = d.consumers[payload.Source]
	// Wildcard fallback: "*" matches all types
	if len(targets) == 0 {
		targets = d.consumers["*"]
	}
	d.mu.RUnlock()

	if len(targets) == 0 {
		d.logger.Debug("no consumers for source type",
			zap.String("source_type", payload.Source),
			zap.String("source_id", payload.SourceID),
		)
		return nil
	}

	var lastErr error
	for i, c := range targets {
		d.logger.Debug("dispatching to consumer",
			zap.String("source_id", payload.SourceID),
			zap.Int("consumer_idx", i),
		)
		if err := d.dispatchWithRetry(ctx, c, payload); err != nil {
			lastErr = err
			d.logger.Warn("consumer failed",
				zap.String("source_id", payload.SourceID),
				zap.Int("consumer_idx", i),
				zap.Error(err),
			)
			// Continue to next consumer (fan-out), don't stop on error
		}
	}
	return lastErr
}

// dispatchWithRetry calls a consumer with exponential backoff retries.
func (d *Dispatcher) dispatchWithRetry(ctx context.Context, c Consumer, payload EventPayload) error {
	maxAttempts := d.retry + 1
	var lastErr error

	for attempt := 1; attempt <= maxAttempts; attempt++ {
		if ctx.Err() != nil {
			return fmt.Errorf("dispatch cancelled: %w", ctx.Err())
		}
		err := c(ctx, payload)
		if err == nil {
			return nil
		}
		lastErr = err
		d.logger.Warn("dispatch attempt failed",
			zap.String("source_id", payload.SourceID),
			zap.Int("attempt", attempt),
			zap.Error(err),
		)
		if attempt < maxAttempts {
			backoff := time.Duration(attempt) * 100 * time.Millisecond
			select {
			case <-time.After(backoff):
			case <-ctx.Done():
				return fmt.Errorf("dispatch cancelled during backoff: %w", ctx.Err())
			}
		}
	}
	return lastErr
}

// ---------------------------------------------------------------------------
// EventRecorder — persists events to the repository
// ---------------------------------------------------------------------------

// EventRecorder wraps the RepositoryInterface to create and update events
// with structured logging.
type EventRecorder struct {
	repo   RepositoryInterface
	logger *zap.Logger
}

// NewEventRecorder creates an event recorder.
func NewEventRecorder(repo RepositoryInterface, logger *zap.Logger) *EventRecorder {
	return &EventRecorder{
		repo:   repo,
		logger: logger,
	}
}

// RecordReceived creates a "received" event record.
func (r *EventRecorder) RecordReceived(ctx context.Context, tenantID, sourceID string, payload EventPayload) (*models.JobSourceEvent, error) {
	ps, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal event payload: %w", err)
	}

	e := &models.JobSourceEvent{
		TenantID:   tenantID,
		SourceID:   sourceID,
		Payload:    string(ps),
		Status:     models.EventStatusReceived,
		ReceivedAt: time.Now().UTC(),
	}
	if err := r.repo.CreateEvent(ctx, e); err != nil {
		return nil, fmt.Errorf("failed to create event record: %w", err)
	}
	r.logger.Debug("event recorded",
		zap.String("source_id", sourceID),
		zap.String("event_id", e.ID),
	)
	return e, nil
}

// RecordProcessed updates an event to "processed" status.
func (r *EventRecorder) RecordProcessed(ctx context.Context, tenantID, eventID, jobID string) error {
	if err := r.repo.UpdateEventStatus(ctx, tenantID, eventID, models.EventStatusProcessed, jobID, ""); err != nil {
		return fmt.Errorf("failed to update event to processed: %w", err)
	}
	r.logger.Debug("event processed",
		zap.String("event_id", eventID),
		zap.String("job_id", jobID),
	)
	return nil
}

// RecordFailed updates an event to "failed" status.
func (r *EventRecorder) RecordFailed(ctx context.Context, tenantID, eventID, errMsg string) error {
	if err := r.repo.UpdateEventStatus(ctx, tenantID, eventID, models.EventStatusFailed, "", errMsg); err != nil {
		return fmt.Errorf("failed to update event to failed: %w", err)
	}
	r.logger.Warn("event failed",
		zap.String("event_id", eventID),
		zap.String("error", errMsg),
	)
	return nil
}

// RecordDispatched updates an event to "dispatched" status.
func (r *EventRecorder) RecordDispatched(ctx context.Context, tenantID, eventID, jobID string) error {
	if err := r.repo.UpdateEventStatus(ctx, tenantID, eventID, models.EventStatusDispatched, jobID, ""); err != nil {
		return fmt.Errorf("failed to update event to dispatched: %w", err)
	}
	r.logger.Debug("event dispatched",
		zap.String("event_id", eventID),
		zap.String("job_id", jobID),
	)
	return nil
}

// ---------------------------------------------------------------------------
// BridgeConsumer — connects Dispatcher to a named downstream processor
// ---------------------------------------------------------------------------

// BridgeConsumer is a typed consumer that routes events to a downstream
// processor by name (e.g. "job-actions", "job-processor").
type BridgeConsumer struct {
	name    string
	handler Consumer
	logger  *zap.Logger
}

// NewBridgeConsumer creates a bridge consumer.
func NewBridgeConsumer(name string, handler Consumer, logger *zap.Logger) *BridgeConsumer {
	return &BridgeConsumer{
		name:    name,
		handler: handler,
		logger:  logger,
	}
}

// Consume processes an event through the bridge consumer's handler.
func (b *BridgeConsumer) Consume(ctx context.Context, payload EventPayload) error {
	b.logger.Debug("bridge consuming event",
		zap.String("bridge", b.name),
		zap.String("source_id", payload.SourceID),
	)
	if err := b.handler(ctx, payload); err != nil {
		return fmt.Errorf("bridge %s failed: %w", b.name, err)
	}
	b.logger.Debug("bridge consumed event",
		zap.String("bridge", b.name),
	)
	return nil
}

// Name returns the bridge name.
func (b *BridgeConsumer) Name() string {
	return b.name
}

// ---------------------------------------------------------------------------
// Compile-time checks
// ---------------------------------------------------------------------------

var _ EventBridge = (*BridgeConsumer)(nil)

// EventBridge is the interface for downstream event consumers.
type EventBridge interface {
	Consume(ctx context.Context, payload EventPayload) error
	Name() string
}
