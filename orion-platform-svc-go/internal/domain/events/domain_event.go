package events

import "time"

// DomainEvent represents a domain event that captures a state change in an aggregate.
// All domain events must implement this interface to be stored in the EventStore.
type DomainEvent interface {
	// AggregateType returns the type name of the aggregate that produced this event.
	AggregateType() string

	// AggregateID returns the ID of the aggregate instance that produced this event.
	AggregateID() string

	// EventType returns the event type identifier (e.g., "pipeline.started").
	EventType() string

	// TenantID returns the tenant ID for multi-tenant isolation.
	TenantID() string

	// OccurredAt returns the timestamp when the event occurred.
	OccurredAt() time.Time

	// Version returns the version number of this event (used for replay filtering).
	Version() int
}

// BaseDomainEvent provides common fields for all domain events.
// Embed this struct in concrete event types to automatically satisfy DomainEvent.
type BaseDomainEvent struct {
	AggregateType string    `json:"aggregate_type"`
	AggregateID   string    `json:"aggregate_id"`
	EventType     string    `json:"event_type"`
	TenantID      string    `json:"tenant_id"`
	OccurredAt    time.Time `json:"occurred_at"`
	Version       int       `json:"version"`
	CorrelationID string    `json:"correlation_id"` // Correlation ID for Saga tracking
	CausationID   string    `json:"causation_id"`   // Causation ID for event chain tracing
}

// AggregateType returns the aggregate type.
func (e *BaseDomainEvent) AggregateType() string { return e.AggregateType }

// AggregateID returns the aggregate ID.
func (e *BaseDomainEvent) AggregateID() string { return e.AggregateID }

// EventType returns the event type identifier.
func (e *BaseDomainEvent) EventType() string { return e.EventType }

// TenantID returns the tenant ID.
func (e *BaseDomainEvent) TenantID() string { return e.TenantID }

// OccurredAt returns the event occurrence time.
func (e *BaseDomainEvent) OccurredAt() time.Time { return e.OccurredAt }

// Version returns the event version number.
func (e *BaseDomainEvent) Version() int { return e.Version }

// NewBaseDomainEvent creates a new BaseDomainEvent with the given parameters.
func NewBaseDomainEvent(
	aggregateType, aggregateID, eventType, tenantID string,
	occurredAt time.Time, version int,
) BaseDomainEvent {
	return BaseDomainEvent{
		AggregateType: aggregateType,
		AggregateID:   aggregateID,
		EventType:     eventType,
		TenantID:      tenantID,
		OccurredAt:    occurredAt,
		Version:       version,
	}
}
