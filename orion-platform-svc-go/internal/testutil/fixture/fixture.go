// Package fixture provides tenant-scoped test fixtures that auto-inject
// tenant_id into events/aggregates/commands, ensuring multi-tenant isolation
// invariants hold by construction.
//
// Fixtures are intended for use with Testcontainers-backed integration tests
// (TEST-2) and with repository/service-level tests. They never read from
// environment variables directly; tenant IDs are passed via the Fixture
// constructor.
package fixture

import (
	"fmt"
	"time"

	"github.com/google/uuid"

	"orion/platform-svc-go/internal/domain/aggregates"
	"orion/platform-svc-go/internal/domain/events"
)

// TenantFixture injects tenant_id into domain objects. It is the foundation
// for GATE-TENANT-ID-100 enforcement: any test that constructs a domain
// object without an explicit tenant ID should use TenantFixture to ensure
// the invariant holds.
type TenantFixture struct {
	tenantID string
	now      func() time.Time
}

// Option is a TenantFixture configuration function.
type Option func(*TenantFixture)

// WithClock replaces the default time source with a fixed clock, for
// deterministic replay tests.
func WithClock(now time.Time) Option {
	return func(f *TenantFixture) {
		f.now = func() time.Time { return now }
	}
}

// New creates a TenantFixture bound to the given tenant ID.
// If tenantID is empty, a fresh "tenant-test-<uuid>" value is generated to
// guarantee isolation between test runs.
func New(tenantID string, opts ...Option) *TenantFixture {
	if tenantID == "" {
		tenantID = "tenant-test-" + uuid.New().String()[:8]
	}
	f := &TenantFixture{
		tenantID: tenantID,
		now:      func() time.Time { return time.Now().UTC() },
	}
	for _, opt := range opts {
		opt(f)
	}
	return f
}

// TenantID returns the bound tenant ID.
func (f *TenantFixture) TenantID() string {
	return f.tenantID
}

// Now returns the fixture's clock value.
func (f *TenantFixture) Now() time.Time {
	return f.now()
}

// Event returns a BaseDomainEvent pre-populated with the fixture tenant ID
// and clock. The caller must still set AggregateType/AggregateID/EventType.
func (f *TenantFixture) Event(aggregateType, aggregateID, eventType string) events.BaseDomainEvent {
	return events.BaseDomainEvent{
		BaseAggregateType: aggregateType,
		BaseAggregateID:   aggregateID,
		BaseEventType:     eventType,
		BaseTenantID:      f.tenantID,
		BaseOccurredAt:    f.now(),
		BaseVersion:       1,
	}
}

// EventWithID is like Event but generates a new aggregate ID.
func (f *TenantFixture) EventWithID(aggregateType, eventType string) events.BaseDomainEvent {
	return f.Event(aggregateType, uuid.New().String(), eventType)
}

// Aggregate returns a BaseAggregate pre-populated with the fixture tenant ID
// and a fresh aggregate ID.
func (f *TenantFixture) Aggregate(aggregateType string) *aggregates.BaseAggregate {
	return &aggregates.BaseAggregate{
		AggregateType: aggregateType,
		AggregateID:   uuid.New().String(),
		TenantID:      f.tenantID,
		Version:       0,
	}
}

// AggregateWithID is like Aggregate but uses the provided aggregate ID.
func (f *TenantFixture) AggregateWithID(aggregateType, aggregateID string) *aggregates.BaseAggregate {
	agg := f.Aggregate(aggregateType)
	agg.AggregateID = aggregateID
	return agg
}

// InjectTenant sets the fixture's tenant ID on any object that implements the
// SetTenantID(id string) method (DomainEvent, BaseAggregate).
func (f *TenantFixture) InjectTenant(obj interface{}) error {
	switch v := obj.(type) {
	case interface{ SetTenantID(string) }:
		v.SetTenantID(f.tenantID)
		return nil
	case *events.BaseDomainEvent:
		v.BaseTenantID = f.tenantID
		return nil
	case *aggregates.BaseAggregate:
		v.TenantID = f.tenantID
		return nil
	default:
		return fmt.Errorf("fixture.InjectTenant: type %T does not implement SetTenantID", obj)
	}
}

// String returns a human-readable fixture summary for debugging.
func (f *TenantFixture) String() string {
	return fmt.Sprintf("TenantFixture{tenantID=%s}", f.tenantID)
}
