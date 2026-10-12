// Package builder provides fluent Builder APIs for constructing test fixtures
// (Aggregate/Event/Command) with reduced boilerplate.
//
// The builders aim to eliminate Snapshot Assertion anti-patterns (e.g. `!= nil`
// checks) by making it cheap to construct fully-populated domain objects that
// can be compared field-by-field via testutil/assertion.
package builder

import (
	"time"

	"github.com/google/uuid"

	"orion/platform-svc-go/internal/domain/aggregates"
	"orion/platform-svc-go/internal/domain/events"
)

// DefaultTenantID is injected into fixtures that do not specify a tenant.
// Tests may override per-builder via WithTenantID.
const DefaultTenantID = "tenant-test"

// ---------------------------------------------------------------------------
// EventBuilder
// ---------------------------------------------------------------------------

// EventBuilder constructs DomainEvent instances via BaseDomainEvent.
// It is the primary tool for producing events in EventStore/Saga tests.
type EventBuilder struct {
	base events.BaseDomainEvent
}

// NewEventBuilder creates an EventBuilder seeded with sensible defaults:
//   - aggregateType: "pipeline"
//   - aggregateID: a new UUID
//   - eventType: "test.created"
//   - tenantID: DefaultTenantID
//   - occurredAt: time.Now().UTC()
//   - version: 1
func NewEventBuilder() *EventBuilder {
	return &EventBuilder{
		base: events.BaseDomainEvent{
			BaseAggregateType: "pipeline",
			BaseAggregateID:   uuid.New().String(),
			BaseEventType:     "test.created",
			BaseTenantID:      DefaultTenantID,
			BaseOccurredAt:    time.Now().UTC(),
			BaseVersion:       1,
		},
	}
}

// WithAggregateType sets the aggregate type (e.g. "pipeline", "approval").
func (b *EventBuilder) WithAggregateType(t string) *EventBuilder {
	b.base.BaseAggregateType = t
	return b
}

// WithAggregateID sets the aggregate ID. Use this when multiple events belong
// to the same aggregate instance.
func (b *EventBuilder) WithAggregateID(id string) *EventBuilder {
	b.base.BaseAggregateID = id
	return b
}

// WithEventType sets the event type identifier (e.g. "pipeline.activated").
func (b *EventBuilder) WithEventType(t string) *EventBuilder {
	b.base.BaseEventType = t
	return b
}

// WithTenantID overrides the default tenant ID.
func (b *EventBuilder) WithTenantID(id string) *EventBuilder {
	b.base.BaseTenantID = id
	return b
}

// WithOccurredAt sets the event timestamp.
func (b *EventBuilder) WithOccurredAt(t time.Time) *EventBuilder {
	b.base.BaseOccurredAt = t
	return b
}

// WithVersion sets the event version (for replay filtering).
func (b *EventBuilder) WithVersion(v int) *EventBuilder {
	b.base.BaseVersion = v
	return b
}

// WithCorrelationID sets the correlation ID for distributed tracing.
func (b *EventBuilder) WithCorrelationID(id string) *EventBuilder {
	b.base.CorrelationID = id
	return b
}

// WithCausationID sets the causation ID for event chain tracking.
func (b *EventBuilder) WithCausationID(id string) *EventBuilder {
	b.base.CausationID = id
	return b
}

// Build returns the constructed DomainEvent.
func (b *EventBuilder) Build() events.DomainEvent {
	ev := b.base // copy
	return &ev
}

// BuildPtr returns a pointer to the constructed BaseDomainEvent. Useful when a
// test needs to mutate the event after construction.
func (b *EventBuilder) BuildPtr() *events.BaseDomainEvent {
	ev := b.base
	return &ev
}

// ---------------------------------------------------------------------------
// AggregateBuilder
// ---------------------------------------------------------------------------

// AggregateBuilder constructs BaseAggregate instances with sane defaults.
// It is the foundation for AggregateRoot test scaffolds.
type AggregateBuilder struct {
	agg aggregates.BaseAggregate
}

// NewAggregateBuilder creates an AggregateBuilder with default values:
//   - AggregateType: "pipeline"
//   - AggregateID: a new UUID
//   - TenantID: DefaultTenantID
//   - Version: 0
func NewAggregateBuilder() *AggregateBuilder {
	return &AggregateBuilder{
		agg: aggregates.BaseAggregate{
			AggregateType: "pipeline",
			AggregateID:   uuid.New().String(),
			TenantID:      DefaultTenantID,
			Version:       0,
		},
	}
}

// WithAggregateType sets the aggregate type.
func (b *AggregateBuilder) WithAggregateType(t string) *AggregateBuilder {
	b.agg.AggregateType = t
	return b
}

// WithAggregateID sets the aggregate ID.
func (b *AggregateBuilder) WithAggregateID(id string) *AggregateBuilder {
	b.agg.AggregateID = id
	return b
}

// WithTenantID overrides the default tenant ID.
func (b *AggregateBuilder) WithTenantID(id string) *AggregateBuilder {
	b.agg.TenantID = id
	return b
}

// WithVersion sets the aggregate version.
func (b *AggregateBuilder) WithVersion(v int) *AggregateBuilder {
	b.agg.Version = v
	return b
}

// Build returns a pointer to the constructed BaseAggregate.
func (b *AggregateBuilder) Build() *aggregates.BaseAggregate {
	agg := b.agg
	return &agg
}

// ---------------------------------------------------------------------------
// CommandBuilder
// ---------------------------------------------------------------------------

// Command is a minimal command envelope for testing command handlers.
// Tests may embed this struct to add command-specific fields.
type Command struct {
	CommandID   string                 `json:"command_id"`
	CommandName string                 `json:"command_name"`
	TenantID    string                 `json:"tenant_id"`
	AggregateID string                 `json:"aggregate_id"`
	Payload     map[string]interface{} `json:"payload,omitempty"`
	IssuedAt    time.Time              `json:"issued_at"`
}

// CommandBuilder constructs Command instances for handler/saga tests.
type CommandBuilder struct {
	cmd Command
}

// NewCommandBuilder creates a CommandBuilder with default values:
//   - CommandName: "test.command"
//   - TenantID: DefaultTenantID
//   - AggregateID: a new UUID
//   - Payload: empty map
//   - IssuedAt: time.Now().UTC()
func NewCommandBuilder() *CommandBuilder {
	return &CommandBuilder{
		cmd: Command{
			CommandID:   uuid.New().String(),
			CommandName: "test.command",
			TenantID:    DefaultTenantID,
			AggregateID: uuid.New().String(),
			Payload:     map[string]interface{}{},
			IssuedAt:    time.Now().UTC(),
		},
	}
}

// WithCommandName sets the command name identifier.
func (b *CommandBuilder) WithCommandName(n string) *CommandBuilder {
	b.cmd.CommandName = n
	return b
}

// WithTenantID overrides the default tenant ID.
func (b *CommandBuilder) WithTenantID(id string) *CommandBuilder {
	b.cmd.TenantID = id
	return b
}

// WithAggregateID sets the target aggregate ID.
func (b *CommandBuilder) WithAggregateID(id string) *CommandBuilder {
	b.cmd.AggregateID = id
	return b
}

// WithPayloadValue sets a single key in the command payload.
func (b *CommandBuilder) WithPayloadValue(key string, value interface{}) *CommandBuilder {
	if b.cmd.Payload == nil {
		b.cmd.Payload = map[string]interface{}{}
	}
	b.cmd.Payload[key] = value
	return b
}

// WithPayload replaces the entire payload.
func (b *CommandBuilder) WithPayload(p map[string]interface{}) *CommandBuilder {
	b.cmd.Payload = p
	return b
}

// WithIssuedAt sets the issued-at timestamp.
func (b *CommandBuilder) WithIssuedAt(t time.Time) *CommandBuilder {
	b.cmd.IssuedAt = t
	return b
}

// Build returns the constructed Command.
func (b *CommandBuilder) Build() Command {
	return b.cmd
}
