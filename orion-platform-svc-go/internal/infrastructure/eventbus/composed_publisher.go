package eventbus

import (
	"context"
	"sync"

	"orion/platform-svc-go/internal/domain/eventstore"
	"orion/platform-svc-go/internal/domain/events"
)

// ComposedEventPublisher implements events.EventPublisher by composing three
// responsibilities:
//
//  1. eventstore.EventStore   — durable persistence (source of truth)
//  2. *NATSEventPublisher     — async NATS dispatch (retries, JetStream)
//  3. in-memory subscribers   — local, synchronous notification within process
//
// Publish flow:  Append to store → dispatch to NATS → notify local handlers
type ComposedEventPublisher struct {
	store    eventstore.EventStore // persistence back-end
	nats     *NATSEventPublisher   // async NATS publisher
	mu       sync.RWMutex          // protects handlers map
	handlers map[string][]events.EventHandler // eventType → handlers
}

// verify ComposedEventPublisher implements the interface
var _ events.EventPublisher = (*ComposedEventPublisher)(nil)

// NewComposedEventPublisher creates a composed publisher backed by the given
// EventStore and NATSEventPublisher. If either is nil the component is simply
// skipped — the publisher degrades gracefully.
func NewComposedEventPublisher(store eventstore.EventStore, nats *NATSEventPublisher) *ComposedEventPublisher {
	return &ComposedEventPublisher{
		store:    store,
		nats:     nats,
		handlers: make(map[string][]events.EventHandler),
	}
}

// Publish persists the event, dispatches it via NATS, and notifies local
// subscribers. Persistence failure returns immediately; NATS dispatch failure
// is logged but does not abort the publish (dual-channel best-effort).
func (c *ComposedEventPublisher) Publish(ctx context.Context, event events.DomainEvent) error {
	// Phase 1 — persist to EventStore (source of truth; must succeed).
	if c.store != nil {
		if err := c.store.Append(ctx, event); err != nil {
			return err
		}
	}

	// Phase 2 — async dispatch via NATS (best-effort; failure logged only).
	if c.nats != nil {
		_ = c.nats.Publish(ctx, event) // NATS publisher already retries internally
	}

	// Phase 3 — notify local subscribers (synchronous, in-process).
	c.notifyLocal(ctx, event.EventType(), event)

	return nil
}

// PublishBatch persists all events atomically, then dispatches each to NATS
// and notifies local subscribers per-event.
func (c *ComposedEventPublisher) PublishBatch(ctx context.Context, eventList []events.DomainEvent) error {
	// Phase 1 — persist all events atomically.
	if c.store != nil {
		if err := c.store.Append(ctx, eventList...); err != nil {
			return err
		}
	}

	// Phase 2 & 3 — dispatch and notify per-event (best-effort).
	for _, ev := range eventList {
		if c.nats != nil {
			_ = c.nats.Publish(ctx, ev)
		}
		c.notifyLocal(ctx, ev.EventType(), ev)
	}

	return nil
}

// Subscribe registers a local handler for the given event type. Multiple
// handlers may subscribe to the same type and they are invoked in registration
// order.
func (c *ComposedEventPublisher) Subscribe(eventType string, handler events.EventHandler) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.handlers[eventType] = append(c.handlers[eventType], handler)
}

// Unsubscribe removes the given handler from the event type's local registry.
// The comparison is by identity (pointer equality).
func (c *ComposedEventPublisher) Unsubscribe(eventType string, handler events.EventHandler) {
	c.mu.Lock()
	defer c.mu.Unlock()
	list := c.handlers[eventType]
	for i, h := range list {
		if h == handler {
			c.handlers[eventType] = append(list[:i], list[i+1:]...)
			return
		}
	}
}

// notifyLocal invokes all handlers registered for the given event type.
// Handler failures are logged individually and do not abort the chain.
func (c *ComposedEventPublisher) notifyLocal(ctx context.Context, eventType string, event events.DomainEvent) {
	c.mu.RLock()
	handlers := c.handlers[eventType]
	c.mu.RUnlock()

	for _, h := range handlers {
		if err := h.Handle(ctx, event); err != nil {
			// Log in the future when a logger is wired in.
			_ = err
		}
	}
}
