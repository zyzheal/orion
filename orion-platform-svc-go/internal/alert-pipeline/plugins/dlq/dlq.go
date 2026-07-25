// Package dlq implements an in-memory DeadLetterQueue for alerts that could
// not be processed after all retries.  In production this is backed by Redis
// streams or a durable topic, but the interface is identical.
package dlq

import (
	"sync"
	"time"

	"orion/platform-svc-go/internal/alert-pipeline/models"

	"go.uber.org/zap"
)

// Queue is an in-memory DeadLetterQueue backed by a ring buffer.
type Queue struct {
	mu     sync.RWMutex
	items  []*models.AlertContext
	reason map[*models.AlertContext]string // reason per item
	cap    int
	logger *zap.Logger
}

// New creates a dead-letter queue with the given capacity.
func New(capacity int, logger *zap.Logger) *Queue {
	if capacity <= 0 {
		capacity = 1000
	}
	return &Queue{
		cap:    capacity,
		items:  make([]*models.AlertContext, 0, capacity),
		reason: make(map[*models.AlertContext]string),
		logger: logger,
	}
}

// Enqueue stores an alert context that failed processing.
func (q *Queue) Enqueue(ctx *models.AlertContext, reason string) error {
	q.mu.Lock()
	defer q.mu.Unlock()
	if len(q.items) >= q.cap {
		// Ring-buffer overflow: drop oldest.
		q.items = q.items[1:]
		q.logger.Warn("dlq overflow, dropping oldest item")
	}
	q.items = append(q.items, ctx)
	q.reason[ctx] = reason
	q.logger.Warn("alert enqueued to dlq",
		zap.String("alert_id", ctx.AlertID),
		zap.String("reason", reason))
	return nil
}

// Dequeue removes and returns the oldest dead-lettered alert.
func (q *Queue) Dequeue() (*models.AlertContext, error) {
	q.mu.Lock()
	defer q.mu.Unlock()
	if len(q.items) == 0 {
		return nil, nil
	}
	ctx := q.items[0]
	q.items = q.items[1:]
	delete(q.reason, ctx)
	return ctx, nil
}

// Peek returns the oldest item without removing it.
func (q *Queue) Peek() (*models.AlertContext, string) {
	q.mu.RLock()
	defer q.mu.RUnlock()
	if len(q.items) == 0 {
		return nil, ""
	}
	return q.items[0], q.reason[q.items[0]]
}

// Size returns the number of dead-lettered alerts.
func (q *Queue) Size() int {
	q.mu.RLock()
	defer q.mu.RUnlock()
	return len(q.items)
}

// All returns a copy of all items (useful for inspection / admin).
func (q *Queue) All() []*models.AlertContext {
	q.mu.RLock()
	defer q.mu.RUnlock()
	out := make([]*models.AlertContext, len(q.items))
	copy(out, q.items)
	return out
}

// Clear removes all dead-lettered items.
func (q *Queue) Clear() {
	q.mu.Lock()
	defer q.mu.Unlock()
	q.items = q.items[:0]
	q.reason = make(map[*models.AlertContext]string)
}

// Expired returns items older than the given age.
func (q *Queue) Expired(before time.Time) []*models.AlertContext {
	q.mu.RLock()
	defer q.mu.RUnlock()
	var out []*models.AlertContext
	for _, item := range q.items {
		if item.Stage.Entered.Before(before) {
			out = append(out, item)
		}
	}
	return out
}
