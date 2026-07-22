package aggregates

import (
	"time"
	"orion/platform-svc-go/internal/domain/events"
)

// AggregateRoot defines the contract for all aggregates in the domain.
type AggregateRoot interface {
	GetAggregateType() string
	GetAggregateID() string
	GetTenantID() string
	GetVersion() int
	SetVersion(int)
	SetAggregateID(id string)
	SetTenantID(id string)
	Apply(events.DomainEvent)
	GetPendingEvents() []events.DomainEvent
	ClearPendingEvents()
}

// BaseAggregate provides common functionality for all aggregate roots.
type BaseAggregate struct {
	AggregateID   string
	TenantID      string
	AggregateType string
	Version       int
	createdAt     time.Time
	updatedAt     time.Time
	pendingEvents []events.DomainEvent
}

func (b *BaseAggregate) GetAggregateType() string { return b.AggregateType }
func (b *BaseAggregate) GetAggregateID() string   { return b.AggregateID }
func (b *BaseAggregate) GetTenantID() string      { return b.TenantID }
func (b *BaseAggregate) GetVersion() int          { return b.Version }
func (b *BaseAggregate) SetVersion(v int)         { b.Version = v }
func (b *BaseAggregate) SetAggregateID(id string) { b.AggregateID = id }
func (b *BaseAggregate) SetTenantID(id string)    { b.TenantID = id }

func (b *BaseAggregate) Apply(e events.DomainEvent) {
	// Default no-op. Subtypes override to apply event to state.
}

func (b *BaseAggregate) GetPendingEvents() []events.DomainEvent { return b.pendingEvents }
func (b *BaseAggregate) ClearPendingEvents()                    { b.pendingEvents = nil }

func (b *BaseAggregate) addEvent(e events.DomainEvent) {
	e.SetAggregateID(b.AggregateID)
	e.SetTenantID(b.TenantID)
	e.SetVersion(b.Version + 1)
	b.pendingEvents = append(b.pendingEvents, e)
	b.Version++
}
