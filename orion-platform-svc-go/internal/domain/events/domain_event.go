package events

import (
	"time"
)

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

	// SetAggregateID sets the aggregate ID (called by AggregateRoot before saving).
	SetAggregateID(id string)

	// SetTenantID sets the tenant ID (called by AggregateRoot before saving).
	SetTenantID(id string)

	// SetVersion sets the version (called by AggregateRoot before saving).
	SetVersion(v int)
}

// BaseDomainEvent provides common fields for all domain events.
// Embed this struct in concrete event types to automatically satisfy DomainEvent.
// Fields are exported with json tags so concrete event fields serialize correctly.
// Field names differ from getter method names to avoid Go compilation conflicts.
type BaseDomainEvent struct {
	BaseAggregateType string    `json:"aggregate_type"`
	BaseAggregateID   string    `json:"aggregate_id"`
	BaseEventType     string    `json:"event_type"`
	BaseTenantID      string    `json:"tenant_id"`
	BaseOccurredAt    time.Time `json:"occurred_at"`
	BaseVersion       int       `json:"version"`
	CorrelationID     string    `json:"correlation_id"`
	CausationID       string    `json:"causation_id"`
}

// AggregateType returns the aggregate type.
func (e *BaseDomainEvent) AggregateType() string { return e.BaseAggregateType }

// AggregateID returns the aggregate ID.
func (e *BaseDomainEvent) AggregateID() string { return e.BaseAggregateID }

// EventType returns the event type identifier.
func (e *BaseDomainEvent) EventType() string { return e.BaseEventType }

// TenantID returns the tenant ID.
func (e *BaseDomainEvent) TenantID() string { return e.BaseTenantID }

// OccurredAt returns the event occurrence time.
func (e *BaseDomainEvent) OccurredAt() time.Time { return e.BaseOccurredAt }

// Version returns the event version number.
func (e *BaseDomainEvent) Version() int { return e.BaseVersion }

// SetAggregateID sets the aggregate ID (called by aggregate when adding the event).
func (e *BaseDomainEvent) SetAggregateID(id string) { e.BaseAggregateID = id }

// SetTenantID sets the tenant ID (called by aggregate when adding the event).
func (e *BaseDomainEvent) SetTenantID(tenantID string) { e.BaseTenantID = tenantID }

// SetVersion sets the event version (called by aggregate when adding the event).
func (e *BaseDomainEvent) SetVersion(v int) { e.BaseVersion = v }

// NewBaseDomainEvent creates a new BaseDomainEvent with the given parameters.
func NewBaseDomainEvent(
	aggregateType, aggregateID, eventType, tenantID string,
	occurredAt time.Time, version int,
) BaseDomainEvent {
	return BaseDomainEvent{
		BaseAggregateType: aggregateType,
		BaseAggregateID:   aggregateID,
		BaseEventType:     eventType,
		BaseTenantID:      tenantID,
		BaseOccurredAt:    occurredAt,
		BaseVersion:       version,
	}
}
