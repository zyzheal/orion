// Package eventpublisher provides a lightweight domain event publishing
// abstraction. This file contains the EventBusAdapter that bridges the
// lightweight EventPublisher interface to the infrastructure-level
// ComposedEventPublisher (events.EventPublisher).
package eventpublisher

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"orion/platform-svc-go/internal/domain/events"
)

// GenericDomainEvent is a minimal DomainEvent implementation that carries
// an arbitrary map[string]any payload. It is used by EventBusAdapter to
// publish domain events from the lightweight EventPublisher interface
// through the infrastructure's ComposedEventPublisher.
type GenericDomainEvent struct {
	events.BaseDomainEvent
	Payload map[string]any `json:"payload,omitempty"`
}

// EventBusAdapter wraps a ComposedEventPublisher (or any events.EventPublisher)
// to satisfy the lightweight EventPublisher interface. Domain services call
// Publish(ctx, eventType, tenantID, payload) and the adapter wraps it into a
// GenericDomainEvent and delegates to the composed publisher, which handles
// persistence + NATS dispatch + local subscriber notification.
type EventBusAdapter struct {
	publisher events.EventPublisher
}

// NewEventBusAdapter creates an EventPublisher backed by the infrastructure's
// composed event publisher. If publisher is nil, all calls are no-ops.
func NewEventBusAdapter(publisher events.EventPublisher) *EventBusAdapter {
	return &EventBusAdapter{publisher: publisher}
}

// Publish implements EventPublisher. It wraps the payload into a
// GenericDomainEvent and delegates to the composed publisher.
func (a *EventBusAdapter) Publish(ctx context.Context, eventType, tenantID string, payload map[string]any) error {
	if a.publisher == nil {
		return nil
	}
	now := time.Now().UTC()
	aggID := eventType + ":" + uuid.New().String()
	ev := &GenericDomainEvent{
		BaseDomainEvent: events.BaseDomainEvent{
			BaseAggregateType: "domain",
			BaseAggregateID:   aggID,
			BaseEventType:     eventType,
			BaseTenantID:      tenantID,
			BaseOccurredAt:    now,
			BaseVersion:       1,
		},
		Payload: payload,
	}
	if err := a.publisher.Publish(ctx, ev); err != nil {
		return fmt.Errorf("publish event %s: %w", eventType, err)
	}
	return nil
}
