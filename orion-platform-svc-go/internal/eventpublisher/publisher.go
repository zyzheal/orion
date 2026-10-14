// Package eventpublisher defines a lightweight interface for publishing
// domain events. It is implemented by the event bus service and injected
// into domain services that need to emit events on mutations.
//
// The interface is deliberately minimal so domain modules don't depend on
// the full event bus package — they only need to call Publish.
package eventpublisher

import "context"

// EventPublisher publishes domain events. Implementations may forward to
// NATS, a local event bus, or be a no-op (nil receiver).
type EventPublisher interface {
	Publish(ctx context.Context, eventType, tenantID string, payload map[string]any) error
}

// NoopPublisher is a no-op implementation that does nothing. It's useful
// for tests and as a default when no event bus is configured.
type NoopPublisher struct{}

func (NoopPublisher) Publish(context.Context, string, string, map[string]any) error {
	return nil
}
