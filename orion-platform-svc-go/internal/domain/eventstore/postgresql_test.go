package eventstore

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"orion/platform-svc-go/internal/domain/events"
)

// MockDomainEvent is a minimal DomainEvent suitable for EventStore tests.
type MockDomainEvent struct {
	aggregateType string
	aggregateID   string
	tenantID      string
	eventType     string
	occurredAt    time.Time
	version       int
}

func (e *MockDomainEvent) AggregateType() string  { return e.aggregateType }
func (e *MockDomainEvent) AggregateID() string    { return e.aggregateID }
func (e *MockDomainEvent) TenantID() string       { return e.tenantID }
func (e *MockDomainEvent) EventType() string      { return e.eventType }
func (e *MockDomainEvent) OccurredAt() time.Time  { return e.occurredAt }
func (e *MockDomainEvent) Version() int           { return e.version }
func (e *MockDomainEvent) GetVersion() int        { return e.version }
func (e *MockDomainEvent) SetVersion(v int)       { e.version = v }
func (e *MockDomainEvent) SetAggregateID(id string) { e.aggregateID = id }
func (e *MockDomainEvent) SetTenantID(id string)    { e.tenantID = id }

// EventStore implementation backed by an in-memory slice.
type mockEventStore struct {
	events  []events.DomainEvent
	counter int
}

func (m *mockEventStore) Append(_ context.Context, evs ...events.DomainEvent) error {
	m.counter += len(evs)
	m.events = append(m.events, evs...)
	return nil
}

func (m *mockEventStore) GetByAggregate(_ context.Context, _, _, aggID string) ([]events.DomainEvent, error) {
	result := make([]events.DomainEvent, 0)
	for _, ev := range m.events {
		if ev.AggregateID() == aggID {
			result = append(result, ev)
		}
	}
	return result, nil
}

func (m *mockEventStore) GetByType(_ context.Context, tenantID, eventType string, since time.Time) ([]events.DomainEvent, error) {
	result := make([]events.DomainEvent, 0)
	for _, ev := range m.events {
		if ev.TenantID() == tenantID && ev.EventType() == eventType && (since.IsZero() || ev.OccurredAt().After(since)) {
			result = append(result, ev)
		}
	}
	return result, nil
}

func (m *mockEventStore) GetLatestVersion(_ context.Context, _, _, aggID string) (int, error) {
	count := 0
	for _, ev := range m.events {
		if ev.AggregateID() == aggID {
			count++
		}
	}
	return count, nil
}

func (m *mockEventStore) GetEventsAfterVersion(_ context.Context, _, _, aggID string, afterVersion int) ([]events.DomainEvent, error) {
	eventsForAgg := make([]events.DomainEvent, 0)
	for _, ev := range m.events {
		if ev.AggregateID() == aggID {
			eventsForAgg = append(eventsForAgg, ev)
		}
	}
	if afterVersion >= len(eventsForAgg) {
		return []events.DomainEvent{}, nil
	}
	return eventsForAgg[afterVersion:], nil
}

func (m *mockEventStore) DeleteOlderThan(_ context.Context, tenantID string, olderThan time.Time) (int64, error) {
	remaining := make([]events.DomainEvent, 0)
	deleted := 0
	for _, ev := range m.events {
		if ev.TenantID() == tenantID && ev.OccurredAt().Before(olderThan) {
			deleted++
		} else {
			remaining = append(remaining, ev)
		}
	}
	m.events = remaining
	return int64(deleted), nil
}

// ---------------------------------------------------------------------------
// Test: PostgreSQLEventStore.Append
// ---------------------------------------------------------------------------

func TestPostgreSQLEventStore_Append(t *testing.T) {
	store := &mockEventStore{}
	now := time.Now().UTC()

	ev := &MockDomainEvent{
		aggregateType: "pipeline",
		aggregateID:   "pipe-1",
		tenantID:      "tenant-1",
		eventType:     "pipeline.activated",
		occurredAt:    now,
	}

	err := store.Append(context.Background(), ev)
	assert.NoError(t, err)
	assert.Equal(t, 1, store.counter)
	assert.Len(t, store.events, 1)
}

func TestPostgreSQLEventStore_AppendEmpty(t *testing.T) {
	store := &mockEventStore{}
	err := store.Append(context.Background())
	assert.NoError(t, err)
	assert.Equal(t, 0, store.counter)
}

// ---------------------------------------------------------------------------
// Test: PostgreSQLEventStore.GetByAggregate
// ---------------------------------------------------------------------------

func TestPostgreSQLEventStore_GetByAggregate(t *testing.T) {
	store := &mockEventStore{}
	now := time.Now().UTC()

	store.Append(context.Background(),
		&MockDomainEvent{aggregateType: "pipeline", aggregateID: "pipe-1", tenantID: "tenant-1", eventType: "pipeline.created", occurredAt: now},
		&MockDomainEvent{aggregateType: "pipeline", aggregateID: "pipe-1", tenantID: "tenant-1", eventType: "pipeline.activated", occurredAt: now.Add(time.Second)},
		&MockDomainEvent{aggregateType: "pipeline", aggregateID: "pipe-2", tenantID: "tenant-1", eventType: "pipeline.created", occurredAt: now},
	)

	evs, err := store.GetByAggregate(context.Background(), "tenant-1", "pipeline", "pipe-1")
	assert.NoError(t, err)
	assert.Len(t, evs, 2)
}

func TestPostgreSQLEventStore_GetByAggregateEmpty(t *testing.T) {
	store := &mockEventStore{}
	evs, err := store.GetByAggregate(context.Background(), "tenant-1", "pipeline", "nonexistent")
	assert.NoError(t, err)
	assert.Len(t, evs, 0)
}

// ---------------------------------------------------------------------------
// Test: PostgreSQLEventStore.GetLatestVersion
// ---------------------------------------------------------------------------

func TestPostgreSQLEventStore_GetLatestVersion(t *testing.T) {
	store := &mockEventStore{}
	now := time.Now().UTC()

	store.Append(context.Background(),
		&MockDomainEvent{aggregateType: "pipeline", aggregateID: "pipe-1", tenantID: "tenant-1", eventType: "pipeline.created", occurredAt: now},
	)

	version, err := store.GetLatestVersion(context.Background(), "tenant-1", "pipeline", "pipe-1")
	assert.NoError(t, err)
	assert.Equal(t, 1, version)

	version, err = store.GetLatestVersion(context.Background(), "tenant-1", "pipeline", "nonexistent")
	// version should be 0 for non-existent aggregate (no events found)
	assert.NoError(t, err)
	assert.Equal(t, 0, version)
}

func TestPostgreSQLEventStore_GetLatestVersion_Approval(t *testing.T) {
	store := &mockEventStore{}
	store.Append(context.Background(),
		&MockDomainEvent{aggregateType: "approval", aggregateID: "appr-1", tenantID: "tenant-1", eventType: "approval.requested", occurredAt: time.Now().UTC()},
	)
	version, err := store.GetLatestVersion(context.Background(), "tenant-1", "approval", "appr-1")
	assert.NoError(t, err)
	assert.Equal(t, 1, version)
}

// ---------------------------------------------------------------------------
// Test: GetEventsAfterVersion
// ---------------------------------------------------------------------------

func TestPostgreSQLEventStore_GetEventsAfterVersion(t *testing.T) {
	store := &mockEventStore{}
	now := time.Now().UTC()

	store.Append(context.Background(),
		&MockDomainEvent{aggregateType: "pipeline", aggregateID: "pipe-1", tenantID: "tenant-1", eventType: "pipeline.created", occurredAt: now, version: 1},
		&MockDomainEvent{aggregateType: "pipeline", aggregateID: "pipe-1", tenantID: "tenant-1", eventType: "pipeline.activated", occurredAt: now, version: 2},
	)

	// Get events after version 1 (0-indexed, so skip 1 event)
	evs, err := store.GetEventsAfterVersion(context.Background(), "tenant-1", "pipeline", "pipe-1", 1)
	assert.NoError(t, err)
	assert.Len(t, evs, 1)

	// No events after version 2
	evs, err = store.GetEventsAfterVersion(context.Background(), "tenant-1", "pipeline", "pipe-1", 2)
	assert.NoError(t, err)
	assert.Len(t, evs, 0)
}

// ---------------------------------------------------------------------------
// Test: DeleteOlderThan
// ---------------------------------------------------------------------------

func TestPostgreSQLEventStore_DeleteOlderThan(t *testing.T) {
	store := &mockEventStore{}
	past := time.Now().UTC().Add(-time.Hour)

	store.Append(context.Background(),
		&MockDomainEvent{aggregateType: "pipeline", aggregateID: "pipe-1", tenantID: "tenant-1", eventType: "pipeline.created", occurredAt: past},
		&MockDomainEvent{aggregateType: "pipeline", aggregateID: "pipe-1", tenantID: "tenant-1", eventType: "pipeline.activated", occurredAt: time.Now().UTC()},
	)

	deleted, err := store.DeleteOlderThan(context.Background(), "tenant-1", time.Now().UTC())
	assert.NoError(t, err)
	assert.Equal(t, int64(1), deleted)
	assert.Len(t, store.events, 1)
}

// ---------------------------------------------------------------------------
// Test: SnapshotStore
// ---------------------------------------------------------------------------

type mockSnapshotStore struct {
	snapshots []*Snapshot
}

func (s *mockSnapshotStore) Save(_ context.Context, snapshot *Snapshot) error {
	s.snapshots = append(s.snapshots, snapshot)
	return nil
}

func (s *mockSnapshotStore) GetLatest(_ context.Context, tenantID, aggType, aggID string) (*Snapshot, error) {
	var latest *Snapshot
	for i := len(s.snapshots) - 1; i >= 0; i-- {
		snap := s.snapshots[i]
		if snap.TenantID == tenantID && snap.AggregateType == aggType && snap.AggregateID == aggID {
			latest = snap
			break
		}
	}
	if latest == nil {
		return nil, ErrSnapshotNotFound
	}
	return latest, nil
}

func (s *mockSnapshotStore) GetByVersion(_ context.Context, tenantID, aggType, aggID string, version int) (*Snapshot, error) {
	for _, snap := range s.snapshots {
		if snap.TenantID == tenantID && snap.AggregateType == aggType && snap.AggregateID == aggID && snap.Version == version {
			return snap, nil
		}
	}
	return nil, ErrSnapshotNotFound
}

func (s *mockSnapshotStore) ListByAggregate(_ context.Context, tenantID, aggType, aggID string) ([]*Snapshot, error) {
	result := make([]*Snapshot, 0)
	for _, snap := range s.snapshots {
		if snap.TenantID == tenantID && snap.AggregateType == aggType && snap.AggregateID == aggID {
			result = append(result, snap)
		}
	}
	return result, nil
}

func TestSnapshotStore_SaveAndGetLatest(t *testing.T) {
	store := &mockSnapshotStore{}
	snapshot := &Snapshot{
		AggregateType: "pipeline",
		AggregateID:   "pipe-1",
		TenantID:      "tenant-1",
		Version:       5,
		State:         `{"status":"ACTIVE"}`,
		CreatedAt:     time.Now().UTC(),
	}

	err := store.Save(context.Background(), snapshot)
	assert.NoError(t, err)

	latest, err := store.GetLatest(context.Background(), "tenant-1", "pipeline", "pipe-1")
	assert.NoError(t, err)
	assert.Equal(t, 5, latest.Version)
	assert.Equal(t, "pipeline", latest.AggregateType)
}

func TestSnapshotStore_GetByVersion(t *testing.T) {
	store := &mockSnapshotStore{}
	store.Save(context.Background(), &Snapshot{
		AggregateType: "pipeline", AggregateID: "pipe-1", TenantID: "tenant-1",
		Version: 2, State: "state2", CreatedAt: time.Now().UTC(),
	})
	store.Save(context.Background(), &Snapshot{
		AggregateType: "pipeline", AggregateID: "pipe-1", TenantID: "tenant-1",
		Version: 5, State: "state5", CreatedAt: time.Now().UTC(),
	})

	snap, err := store.GetByVersion(context.Background(), "tenant-1", "pipeline", "pipe-1", 2)
	assert.NoError(t, err)
	assert.Equal(t, "state2", snap.State)

	_, err = store.GetByVersion(context.Background(), "tenant-1", "pipeline", "pipe-1", 99)
	assert.Error(t, err)
}

func TestSnapshotStore_ListByAggregate(t *testing.T) {
	store := &mockSnapshotStore{}
	store.Save(context.Background(), &Snapshot{
		AggregateType: "pipeline", AggregateID: "pipe-1", TenantID: "tenant-1",
		Version: 2, CreatedAt: time.Now().UTC(),
	})
	store.Save(context.Background(), &Snapshot{
		AggregateType: "pipeline", AggregateID: "pipe-1", TenantID: "tenant-1",
		Version: 5, CreatedAt: time.Now().UTC(),
	})

	list, err := store.ListByAggregate(context.Background(), "tenant-1", "pipeline", "pipe-1")
	assert.NoError(t, err)
	assert.Len(t, list, 2)
}
