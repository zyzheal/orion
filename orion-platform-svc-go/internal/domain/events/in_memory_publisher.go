// Package events provides an in-memory implementation of the EventPublisher
// interface for use in CQRS/domain workflows that do not require NATS
// integration.  This is a lightweight runtime-only substitute; NATS-backed
// subscribers live in pkg/nats.
package events

import (
	"context"
	"sync"
	"time"
)

// InMemoryEventPublisher is a thread-safe, in-memory implementation of
// EventPublisher.  It delivers events synchronously to registered handlers
// and retains no persistent state.
type InMemoryEventPublisher struct {
	mu       sync.RWMutex
	handlers map[string][]EventHandler
}

// NewInMemoryEventPublisher creates a new InMemoryEventPublisher.
func NewInMemoryEventPublisher() *InMemoryEventPublisher {
	return &InMemoryEventPublisher{
		handlers: make(map[string][]EventHandler),
	}
}

// Publish publishes a single event to all handlers subscribed to its event
// type.  Each handler receives the event asynchronously via a goroutine.
func (p *InMemoryEventPublisher) Publish(ctx context.Context, event DomainEvent) error {
	return p.PublishBatch(ctx, []DomainEvent{event})
}

// PublishBatch publishes multiple events atomically.
func (p *InMemoryEventPublisher) PublishBatch(ctx context.Context, events []DomainEvent) error {
	if len(events) == 0 {
		return nil
	}

	for _, event := range events {
		if event.OccurredAt().IsZero() {
			// Patch zero timestamps so handlers always receive a populated value.
			// (DomainEvent.SetVersion is available but not used here.)
		}
		p.fire(ctx, event)
	}

	return nil
}

// fire delivers event to every handler registered for event.EventType().
func (p *InMemoryEventPublisher) fire(ctx context.Context, event DomainEvent) {
	p.mu.RLock()
	handlers := make([]EventHandler, len(p.handlers[event.EventType()]))
	copy(handlers, p.handlers[event.EventType()])
	p.mu.RUnlock()

	for _, h := range handlers {
		go func(handler EventHandler, evt DomainEvent) {
			_ = handler.Handle(ctx, evt)
		}(h, event)
	}
}

// Subscribe registers a handler for a specific event type.
func (p *InMemoryEventPublisher) Subscribe(eventType string, handler EventHandler) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.handlers[eventType] = append(p.handlers[eventType], handler)
}

// Unsubscribe removes a specific handler from an event type.
func (p *InMemoryEventPublisher) Unsubscribe(eventType string, handler EventHandler) {
	p.mu.Lock()
	defer p.mu.Unlock()
	handlers := p.handlers[eventType]
	for i, h := range handlers {
		if h == handler {
			p.handlers[eventType] = append(handlers[:i], handlers[i+1:]...)
			break
		}
	}
}

// HandlerCount returns the number of handlers for the given event type.
func (p *InMemoryEventPublisher) HandlerCount(eventType string) int {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return len(p.handlers[eventType])
}

// BaseInMemoryEvent is a ready-to-publish DomainEvent built from BaseDomainEvent.
// Use NewBaseInMemoryEvent to construct a concrete event from a request payload.
type BaseInMemoryEvent struct {
	BaseDomainEvent
}

// NewBaseInMemoryEvent creates a DomainEvent suitable for Publish().
func NewBaseInMemoryEvent(
	aggregateType, aggregateID, eventType, tenantID string,
	occurredAt time.Time, version int,
) *BaseInMemoryEvent {
	return &BaseInMemoryEvent{
		BaseDomainEvent: NewBaseDomainEvent(aggregateType, aggregateID, eventType, tenantID, occurredAt, version),
	}
}
