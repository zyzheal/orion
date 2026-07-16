package events

import (
	"encoding/json"
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
// Unexported fields use custom MarshalJSON/UnmarshalJSON for serialization.
type BaseDomainEvent struct {
	aggregateType string
	aggregateID   string
	eventType     string
	tenantID      string
	occurredAt    time.Time
	version       int
	CorrelationID string `json:"correlation_id"`
	CausationID   string `json:"causation_id"`
}

// MarshalJSON implements json.Marshaler for BaseDomainEvent so that
// unexported fields are included in serialization.
func (e BaseDomainEvent) MarshalJSON() ([]byte, error) {
	return json.Marshal(map[string]interface{}{
		"aggregate_type": e.aggregateType,
		"aggregate_id":   e.aggregateID,
		"event_type":     e.eventType,
		"tenant_id":      e.tenantID,
		"occurred_at":    e.occurredAt,
		"version":        e.version,
		"correlation_id": e.CorrelationID,
		"causation_id":   e.CausationID,
	})
}

// UnmarshalJSON implements json.Unmarshaler for BaseDomainEvent.
func (e *BaseDomainEvent) UnmarshalJSON(data []byte) error {
	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	if v, ok := raw["aggregate_type"].(string); ok {
		e.aggregateType = v
	}
	if v, ok := raw["aggregate_id"].(string); ok {
		e.aggregateID = v
	}
	if v, ok := raw["event_type"].(string); ok {
		e.eventType = v
	}
	if v, ok := raw["tenant_id"].(string); ok {
		e.tenantID = v
	}
	if v, ok := raw["occurred_at"].(string); ok {
		t, err := time.Parse(time.RFC3339Nano, v)
		if err == nil {
			e.occurredAt = t
		}
	}
	if v, ok := raw["version"].(float64); ok {
		e.version = int(v)
	}
	if v, ok := raw["correlation_id"].(string); ok {
		e.CorrelationID = v
	}
	if v, ok := raw["causation_id"].(string); ok {
		e.CausationID = v
	}
	return nil
}

// AggregateType returns the aggregate type.
func (e *BaseDomainEvent) AggregateType() string { return e.aggregateType }

// AggregateID returns the aggregate ID.
func (e *BaseDomainEvent) AggregateID() string { return e.aggregateID }

// EventType returns the event type identifier.
func (e *BaseDomainEvent) EventType() string { return e.eventType }

// TenantID returns the tenant ID.
func (e *BaseDomainEvent) TenantID() string { return e.tenantID }

// OccurredAt returns the event occurrence time.
func (e *BaseDomainEvent) OccurredAt() time.Time { return e.occurredAt }

// Version returns the event version number.
func (e *BaseDomainEvent) Version() int { return e.version }

// SetAggregateID sets the aggregate ID (called by aggregate when adding the event).
func (e *BaseDomainEvent) SetAggregateID(id string) { e.aggregateID = id }

// SetTenantID sets the tenant ID (called by aggregate when adding the event).
func (e *BaseDomainEvent) SetTenantID(tenantID string) { e.tenantID = tenantID }

// SetVersion sets the event version (called by aggregate when adding the event).
func (e *BaseDomainEvent) SetVersion(v int) { e.version = v }

// NewBaseDomainEvent creates a new BaseDomainEvent with the given parameters.
func NewBaseDomainEvent(
	aggregateType, aggregateID, eventType, tenantID string,
	occurredAt time.Time, version int,
) BaseDomainEvent {
	return BaseDomainEvent{
		aggregateType: aggregateType,
		aggregateID:   aggregateID,
		eventType:     eventType,
		tenantID:      tenantID,
		occurredAt:    occurredAt,
		version:       version,
	}
}
