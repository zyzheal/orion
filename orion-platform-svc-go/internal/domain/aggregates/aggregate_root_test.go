package aggregates

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"orion/platform-svc-go/internal/domain/events"
)

func TestBaseAggregate_GettersAndSetters(t *testing.T) {
	b := &BaseAggregate{}

	// Setters
	b.SetAggregateID("agg-1")
	b.SetTenantID("tenant-1")
	b.SetVersion(5)

	// Getters
	assert.Equal(t, "agg-1", b.GetAggregateID())
	assert.Equal(t, "tenant-1", b.GetTenantID())
	assert.Equal(t, 5, b.GetVersion())
}

func TestBaseAggregate_GetAggregateType(t *testing.T) {
	b := &BaseAggregate{AggregateType: "pipeline"}
	assert.Equal(t, "pipeline", b.GetAggregateType())
}

func TestBaseAggregate_Apply_DefaultNoOp(t *testing.T) {
	b := &BaseAggregate{
		AggregateID:   "agg-1",
		TenantID:      "tenant-1",
		AggregateType: "test",
		Version:       1,
	}
	// Apply should be a no-op on BaseAggregate — no panic, no state change
	b.Apply(&events.BaseDomainEvent{})
	assert.Equal(t, 1, b.GetVersion()) // version unchanged
	assert.Equal(t, "agg-1", b.GetAggregateID())
}

func TestBaseAggregate_AddEvent_PendingAndVersion(t *testing.T) {
	b := &BaseAggregate{
		AggregateID:   "agg-1",
		TenantID:      "tenant-1",
		AggregateType: "test",
		Version:       0,
	}
	assert.Empty(t, b.GetPendingEvents())

	b.addEvent(&events.BaseDomainEvent{BaseEventType: "test.created"})
	b.addEvent(&events.BaseDomainEvent{BaseEventType: "test.updated"})

	// addEvent should bump version and accumulate pending events
	assert.Equal(t, 2, b.GetVersion())
	assert.Len(t, b.GetPendingEvents(), 2)

	// ClearPendingEvents
	b.ClearPendingEvents()
	assert.Empty(t, b.GetPendingEvents())
}
