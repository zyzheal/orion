package event

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"go.uber.org/zap"
)

// Event is the union type the bus transports.  In production this can be
// backed by NATS/Redis streams; the in-memory implementation is used here
// to keep the pipeline buildable without external dependencies.
type Event interface {
	EventType() EventType
	TenantID() string
}

// eventType implements the Event interface for all concrete event types by
// delegating to a helper that each concrete type embeds via BaseEvent.

// MarshalJSON allows any event to be serialized through a common codec.
type JSONEvent struct {
	Type   string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

// Bus is a pub/sub event bus for alert lifecycle events.  It supports
// synchronous fan-out to registered subscribers and stores events in a
// bounded buffer for timeline replay.
type Bus struct {
	mu       sync.RWMutex
	logger   *zap.Logger
	disabled bool

	subscribers map[EventType][]Subscriber
	buffer      []BaseEvent // bounded replay buffer
	bufSize     int
}

// Subscriber is called synchronously when an event is published.  Return
// an error to signal delivery failure; the bus continues delivery to
// remaining subscribers.
type Subscriber func(ctx context.Context, event Event) error

// BusOption configures the event bus.
type BusOption func(*Bus)

// WithLogger sets the structured logger for the bus.
func WithLogger(logger *zap.Logger) BusOption {
	return func(b *Bus) { b.logger = logger }
}

// WithBuffer sets the maximum number of events retained for timeline replay.
func WithBuffer(size int) BusOption {
	return func(b *Bus) { b.bufSize = size }
}

// NewBus creates a new event bus.
func NewBus(opts ...BusOption) *Bus {
	b := &Bus{
		logger:      zap.NewNop(),
		subscribers: make(map[EventType][]Subscriber),
		bufSize:     1000,
	}
	for _, opt := range opts {
		opt(b)
	}
	return b
}

// Subscribe registers a subscriber for one or more event types.
func (b *Bus) Subscribe(eventTypes []EventType, fn Subscriber) {
	b.mu.Lock()
	defer b.mu.Unlock()
	for _, t := range eventTypes {
		b.subscribers[t] = append(b.subscribers[t], fn)
	}
}

// Publish dispatches an event to all subscribers of its type.  It is safe
// for concurrent callers.
func (b *Bus) Publish(ctx context.Context, event Event) error {
	if b.disabled {
		return nil
	}

	et := event.EventType()
	b.logger.Debug("publishing event",
		zap.String("type", string(et)),
		zap.Any("event", event))

	b.mu.RLock()
	subs := make([]Subscriber, len(b.subscribers[et]))
	copy(subs, b.subscribers[et])
	b.mu.RUnlock()

	var firstErr error
	for _, sub := range subs {
		if err := sub(ctx, event); err != nil {
			if firstErr == nil {
				firstErr = err
			}
			b.logger.Error("subscriber error",
				zap.Error(err),
				zap.String("type", string(et)))
		}
	}

	// Persist to buffer for timeline replay.
	if base, ok := asBaseEvent(event); ok {
		b.pushBuffer(base)
	}

	return firstErr
}

// Timeline returns events matching the correlation key, newest first.
func (b *Bus) Timeline(ctx context.Context, tenantID, groupID, alertID string, since time.Time) ([]BaseEvent, error) {
	_ = ctx
	b.mu.RLock()
	defer b.mu.RUnlock()

	var out []BaseEvent
	for _, e := range b.buffer {
		if e.TenantID != tenantID {
			continue
		}
		if groupID != "" && e.GroupID != groupID {
			continue
		}
		if alertID != "" && e.AlertID != alertID {
			continue
		}
		if !e.Timestamp.After(since) {
			continue
		}
		out = append(out, e)
	}
	return out, nil
}

// Stats returns subscriber counts per event type.
func (b *Bus) Stats() map[string]int {
	b.mu.RLock()
	defer b.mu.RUnlock()
	s := make(map[string]int)
	for t, subs := range b.subscribers {
		s[string(t)] = len(subs)
	}
	return s
}

func (b *Bus) pushBuffer(e BaseEvent) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.buffer = append(b.buffer, e)
	for len(b.buffer) > b.bufSize {
		b.buffer = b.buffer[1:]
	}
}

// asBaseEvent extracts a BaseEvent from a concrete event.
func asBaseEvent(e Event) (BaseEvent, bool) {
	switch v := e.(type) {
	case *AlertEvent:
		return v.BaseEvent, true
	case *AcknowledgedEvent:
		return v.BaseEvent, true
	case *ResolvedEvent:
		return v.BaseEvent, true
	case *EscalatedEvent:
		return v.BaseEvent, true
	case *SuppressedEvent:
		return v.BaseEvent, true
	}
	return BaseEvent{}, false
}

// eventImpl implements the Event interface for each concrete type.

// EventType returns the event's type — implemented inline for each struct below.
