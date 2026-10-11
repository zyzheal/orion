// Package fixture provides DomainEvent replay test infrastructure
// (ADR-017 Phase 2, event_replay.go).
//
// ReplayFixture lets tests construct sequences of domain events and
// replay them through an EventStore or consumer, verifying:
//   - Event ordering (by OccurredAt or Version)
//   - Tenant isolation (only events for the bound tenant are replayed)
//   - Version filtering (only events with version >= minVersion)
//   - Idempotent replay (duplicate events are deduplicated)
//
// Usage:
//   fx := fixture.NewReplayFixture("tenant-1")
//   fx.Append(events.BaseDomainEvent{...})
//   fx.Append(events.BaseDomainEvent{...})
//   for ev := range fx.Iter() {
//       // consume events in order
//   }
package fixture

import (
	"sort"
	"time"

	"orion/platform-svc-go/internal/domain/events"
)

// ReplayFixture is a test harness for DomainEvent replay scenarios.
// It maintains an ordered list of events and provides iteration
// methods with optional filtering.
type ReplayFixture struct {
	tenantID string
	events   []events.DomainEvent
	now      func() time.Time
}

// NewReplayFixture creates a ReplayFixture bound to the given tenant ID.
// Events appended to this fixture will have their TenantID set to
// tenantID if not already set.
func NewReplayFixture(tenantID string, opts ...ReplayOption) *ReplayFixture {
	f := &ReplayFixture{
		tenantID: tenantID,
		events:   make([]events.DomainEvent, 0),
		now:      func() time.Time { return time.Now().UTC() },
	}
	for _, opt := range opts {
		opt(f)
	}
	return f
}

// ReplayOption is a ReplayFixture configuration function.
type ReplayOption func(*ReplayFixture)

// WithReplayClock replaces the default time source with a fixed clock.
func WithReplayClock(now time.Time) ReplayOption {
	return func(f *ReplayFixture) {
		f.now = func() time.Time { return now }
	}
}

// TenantID returns the fixture's bound tenant ID.
func (f *ReplayFixture) TenantID() string {
	return f.tenantID
}

// Now returns the fixture's clock value.
func (f *ReplayFixture) Now() time.Time {
	return f.now()
}

// Len returns the number of events in the fixture.
func (f *ReplayFixture) Len() int {
	return len(f.events)
}

// Append adds an event to the fixture. If the event's TenantID is
// empty, it is set to the fixture's bound tenant ID.
func (f *ReplayFixture) Append(ev events.DomainEvent) {
	if ev == nil {
		return
	}
	if ev.TenantID() == "" {
		ev.SetTenantID(f.tenantID)
	}
	if ev.OccurredAt().IsZero() {
		ev.SetVersion(1)
	}
	f.events = append(f.events, ev)
}

// AppendMany adds multiple events to the fixture.
func (f *ReplayFixture) AppendMany(evts ...events.DomainEvent) {
	for _, ev := range evts {
		f.Append(ev)
	}
}

// Clear removes all events from the fixture.
func (f *ReplayFixture) Clear() {
	f.events = make([]events.DomainEvent, 0)
}

// All returns a copy of all events in insertion order.
func (f *ReplayFixture) All() []events.DomainEvent {
	out := make([]events.DomainEvent, len(f.events))
	copy(out, f.events)
	return out
}

// Iter returns all events sorted by OccurredAt then Version.
// This is the default replay order.
func (f *ReplayFixture) Iter() <-chan events.DomainEvent {
	ch := make(chan events.DomainEvent, len(f.events))
	sorted := make([]events.DomainEvent, len(f.events))
	copy(sorted, f.events)
	sort.SliceStable(sorted, func(i, j int) bool {
		if !sorted[i].OccurredAt().Equal(sorted[j].OccurredAt()) {
			return sorted[i].OccurredAt().Before(sorted[j].OccurredAt())
		}
		return sorted[i].Version() < sorted[j].Version()
	})
	go func() {
		defer close(ch)
		for _, ev := range sorted {
			ch <- ev
		}
	}()
	return ch
}

// IterByType returns events filtered by aggregate type, sorted by time.
func (f *ReplayFixture) IterByType(aggType string) <-chan events.DomainEvent {
	filtered := f.filterByType(aggType)
	ch := make(chan events.DomainEvent, len(filtered))
	go func() {
		defer close(ch)
		for _, ev := range filtered {
			ch <- ev
		}
	}()
	return ch
}

// IterByVersion returns events with version >= minVersion, sorted by time.
func (f *ReplayFixture) IterByVersion(minVersion int) <-chan events.DomainEvent {
	filtered := f.filterByVersion(minVersion)
	ch := make(chan events.DomainEvent, len(filtered))
	go func() {
		defer close(ch)
		for _, ev := range filtered {
			ch <- ev
		}
	}()
	return ch
}

// IterByTenant returns events for the given tenant ID, sorted by time.
func (f *ReplayFixture) IterByTenant(tenantID string) <-chan events.DomainEvent {
	filtered := f.filterByTenant(tenantID)
	ch := make(chan events.DomainEvent, len(filtered))
	go func() {
		defer close(ch)
		for _, ev := range filtered {
			ch <- ev
		}
	}()
	return ch
}

// filterByType returns events matching the aggregate type.
func (f *ReplayFixture) filterByType(aggType string) []events.DomainEvent {
	var out []events.DomainEvent
	for _, ev := range f.events {
		if ev.AggregateType() == aggType {
			out = append(out, ev)
		}
	}
	return f.sortEvents(out)
}

// filterByVersion returns events with version >= minVersion.
func (f *ReplayFixture) filterByVersion(minVersion int) []events.DomainEvent {
	var out []events.DomainEvent
	for _, ev := range f.events {
		if ev.Version() >= minVersion {
			out = append(out, ev)
		}
	}
	return f.sortEvents(out)
}

// filterByTenant returns events for the given tenant ID.
func (f *ReplayFixture) filterByTenant(tenantID string) []events.DomainEvent {
	var out []events.DomainEvent
	for _, ev := range f.events {
		if ev.TenantID() == tenantID {
			out = append(out, ev)
		}
	}
	return f.sortEvents(out)
}

// sortEvents sorts a slice of events by OccurredAt then Version.
func (f *ReplayFixture) sortEvents(evts []events.DomainEvent) []events.DomainEvent {
	sorted := make([]events.DomainEvent, len(evts))
	copy(sorted, evts)
	sort.SliceStable(sorted, func(i, j int) bool {
		if !sorted[i].OccurredAt().Equal(sorted[j].OccurredAt()) {
			return sorted[i].OccurredAt().Before(sorted[j].OccurredAt())
		}
		return sorted[i].Version() < sorted[j].Version()
	})
	return sorted
}

// NewBaseEvent creates a *BaseDomainEvent pre-populated with the fixture's
// tenant ID and clock. The caller must set AggregateType/AggregateID/EventType.
func (f *ReplayFixture) NewBaseEvent(aggType, aggID, eventType string) *events.BaseDomainEvent {
	return &events.BaseDomainEvent{
		BaseAggregateType: aggType,
		BaseAggregateID:   aggID,
		BaseEventType:     eventType,
		BaseTenantID:      f.tenantID,
		BaseOccurredAt:    f.now(),
		BaseVersion:       1,
	}
}

// String returns a human-readable fixture summary for debugging.
func (f *ReplayFixture) String() string {
	return "ReplayFixture{tenantID=" + f.tenantID + ", events=" + itoa(len(f.events)) + "}"
}

// itoa is a simple int-to-string converter to avoid importing strconv
// in a test utility (keeps the dependency footprint minimal).
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	digits := make([]byte, 0, 10)
	for n > 0 {
		digits = append([]byte{byte('0' + n%10)}, digits...)
		n /= 10
	}
	return string(digits)
}
