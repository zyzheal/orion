package events

import "context"

// EventPublisher defines the interface for publishing domain events.
// It supports both synchronous and asynchronous publication.
type EventPublisher interface {
	// Publish publishes a single event (sync + async dual-channel).
	// The event is first persisted to EventStore, then dispatched via NATS.
	Publish(ctx context.Context, event DomainEvent) error

	// PublishBatch publishes multiple events atomically.
	PublishBatch(ctx context.Context, events []DomainEvent) error

	// Subscribe registers an event handler for a specific event type.
	// Multiple handlers can subscribe to the same event type.
	Subscribe(eventType string, handler EventHandler)

	// Unsubscribe removes a specific handler from an event type.
	Unsubscribe(eventType string, handler EventHandler)
}

// EventHandler is the interface for handling domain events.
type EventHandler interface {
	// Handle processes a domain event (called asynchronously).
	// Implementations should be idempotent since events may be replayed.
	Handle(ctx context.Context, event DomainEvent) error

	// Supports declares which event types this handler supports.
	Supports() []string
}

// EventSubscriberManager manages event subscriber lifecycle.
type EventSubscriberManager interface {
	// Register registers a handler for all event types it supports.
	Register(handler EventHandler)

	// Unregister removes a handler from all its subscribed event types.
	Unregister(handler EventHandler)

	// GetSubscribers returns all handlers subscribed to an event type.
	GetSubscribers(eventType string) []EventHandler
}
