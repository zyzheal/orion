package application

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"orion/platform-svc-go/internal/domain/aggregates"
	"orion/platform-svc-go/internal/domain/events"
	"orion/platform-svc-go/internal/domain/eventstore"
)

// ---------------------------------------------------------------------------
// Mock EventStore
// ---------------------------------------------------------------------------

type mockEventStore struct {
	events  []events.DomainEvent
	appendErr error
}

func (m *mockEventStore) Append(_ context.Context, evs ...events.DomainEvent) error {
	if m.appendErr != nil {
		return m.appendErr
	}
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
	evs := make([]events.DomainEvent, 0)
	for _, ev := range m.events {
		if ev.AggregateID() == aggID {
			evs = append(evs, ev)
		}
	}
	if afterVersion >= len(evs) {
		return []events.DomainEvent{}, nil
	}
	return evs[afterVersion:], nil
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
// Mock SnapshotStore
// ---------------------------------------------------------------------------

type mockSnapshotStore struct {
	snapshots []*eventstore.Snapshot
}

func (s *mockSnapshotStore) Save(_ context.Context, snapshot *eventstore.Snapshot) error {
	s.snapshots = append(s.snapshots, snapshot)
	return nil
}

func (s *mockSnapshotStore) GetLatest(_ context.Context, tenantID, aggType, aggID string) (*eventstore.Snapshot, error) {
	var latest *eventstore.Snapshot
	for i := len(s.snapshots) - 1; i >= 0; i-- {
		snap := s.snapshots[i]
		if snap.TenantID == tenantID && snap.AggregateType == aggType && snap.AggregateID == aggID {
			latest = snap
			break
		}
	}
	if latest == nil {
		return nil, eventstore.ErrSnapshotNotFound
	}
	return latest, nil
}

func (s *mockSnapshotStore) GetByVersion(_ context.Context, tenantID, aggType, aggID string, version int) (*eventstore.Snapshot, error) {
	for _, snap := range s.snapshots {
		if snap.TenantID == tenantID && snap.AggregateType == aggType && snap.AggregateID == aggID && snap.Version == version {
			return snap, nil
		}
	}
	return nil, eventstore.ErrSnapshotNotFound
}

func (s *mockSnapshotStore) ListByAggregate(_ context.Context, tenantID, aggType, aggID string) ([]*eventstore.Snapshot, error) {
	result := make([]*eventstore.Snapshot, 0)
	for _, snap := range s.snapshots {
		if snap.TenantID == tenantID && snap.AggregateType == aggType && snap.AggregateID == aggID {
			result = append(result, snap)
		}
	}
	return result, nil
}

// ---------------------------------------------------------------------------
// AggregateLoader Tests
// ---------------------------------------------------------------------------

func TestAggregateLoader_Load(t *testing.T) {
	t.Run("loads aggregate from event stream", func(t *testing.T) {
		store := &mockEventStore{}
		store.Append(context.Background(),
			&testDomainEvent{aggregateID: "pipe-1", tenantID: "t1", eventType: "pipeline.created"},
			&testDomainEvent{aggregateID: "pipe-1", tenantID: "t1", eventType: "pipeline.activated"},
		)

		loader := NewAggregateLoader(store)
		agg, err := loader.Load(context.Background(), "t1", "pipeline", "pipe-1", func() aggregates.AggregateRoot {
			return &aggregates.PipelineAggregate{
				BaseAggregate: aggregates.BaseAggregate{
					AggregateType: "pipeline",
				},
			}
		})

		assert.NoError(t, err)
		assert.NotNil(t, agg)
		assert.Equal(t, "pipe-1", agg.GetAggregateID())
		assert.Equal(t, "t1", agg.GetTenantID())
	})

	t.Run("returns ErrAggregateNotFound for empty stream", func(t *testing.T) {
		store := &mockEventStore{}
		loader := NewAggregateLoader(store)
		_, err := loader.Load(context.Background(), "t1", "pipeline", "nonexistent", func() aggregates.AggregateRoot {
			return &aggregates.PipelineAggregate{}
		})
		assert.ErrorIs(t, err, ErrAggregateNotFound)
	})

	t.Run("returns error when store is nil", func(t *testing.T) {
		loader := NewAggregateLoader(nil)
		_, err := loader.Load(context.Background(), "t1", "pipeline", "pipe-1", func() aggregates.AggregateRoot {
			return &aggregates.PipelineAggregate{}
		})
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "EventStore is nil")
	})
}

// ---------------------------------------------------------------------------
// AggregateService Tests
// ---------------------------------------------------------------------------

func TestAggregateService_RebuildPipeline(t *testing.T) {
	t.Run("rebuilds pipeline aggregate from events", func(t *testing.T) {
		store := &mockEventStore{}
		store.Append(context.Background(),
			&testDomainEvent{aggregateID: "pipe-1", tenantID: "t1", eventType: "pipeline.created"},
		)

		svc := NewAggregateService(store)
		agg, err := svc.RebuildPipeline(context.Background(), "t1", "pipe-1")

		assert.NoError(t, err)
		assert.NotNil(t, agg)
		assert.Equal(t, "pipe-1", agg.GetAggregateID())
	})

	t.Run("returns ErrAggregateNotFound for empty stream", func(t *testing.T) {
		svc := NewAggregateService(&mockEventStore{})
		_, err := svc.RebuildPipeline(context.Background(), "t1", "nonexistent")
		assert.ErrorIs(t, err, ErrAggregateNotFound)
	})

	t.Run("returns error when store is nil", func(t *testing.T) {
		svc := NewAggregateService(nil)
		_, err := svc.RebuildPipeline(context.Background(), "t1", "pipe-1")
		assert.Error(t, err)
	})
}

func TestAggregateService_RebuildApproval(t *testing.T) {
	t.Run("rebuilds approval aggregate from events", func(t *testing.T) {
		store := &mockEventStore{}
		store.Append(context.Background(),
			&testDomainEvent{aggregateID: "appr-1", tenantID: "t1", eventType: "approval.created"},
			&testDomainEvent{aggregateID: "appr-1", tenantID: "t1", eventType: "approval.level_approved"},
		)

		svc := NewAggregateService(store)
		agg, err := svc.RebuildApproval(context.Background(), "t1", "appr-1")

		assert.NoError(t, err)
		assert.NotNil(t, agg)
		assert.Equal(t, "appr-1", agg.GetAggregateID())
	})

	t.Run("returns ErrAggregateNotFound for empty stream", func(t *testing.T) {
		svc := NewAggregateService(&mockEventStore{})
		_, err := svc.RebuildApproval(context.Background(), "t1", "nonexistent")
		assert.ErrorIs(t, err, ErrAggregateNotFound)
	})
}

func TestAggregateService_RebuildFeatureFlag(t *testing.T) {
	t.Run("rebuilds feature flag aggregate from events", func(t *testing.T) {
		store := &mockEventStore{}
		store.Append(context.Background(),
			&testDomainEvent{aggregateID: "flag-key-1", tenantID: "t1", eventType: "feature_flag.toggled"},
		)

		svc := NewAggregateService(store)
		agg, err := svc.RebuildFeatureFlag(context.Background(), "t1", "flag-key-1")

		assert.NoError(t, err)
		assert.NotNil(t, agg)
		assert.Equal(t, "flag-key-1", agg.GetAggregateID())
	})

	t.Run("returns ErrAggregateNotFound for empty stream", func(t *testing.T) {
		svc := NewAggregateService(&mockEventStore{})
		_, err := svc.RebuildFeatureFlag(context.Background(), "t1", "nonexistent")
		assert.ErrorIs(t, err, ErrAggregateNotFound)
	})
}

func TestAggregateService_NewAggregates(t *testing.T) {
	t.Run("creates new pipeline aggregate", func(t *testing.T) {
		svc := NewAggregateService(&mockEventStore{})
		agg := svc.NewPipelineAggregate()
		assert.NotNil(t, agg)
		assert.Equal(t, AggregateTypePipeline, agg.GetAggregateType())
	})

	t.Run("creates new approval aggregate", func(t *testing.T) {
		svc := NewAggregateService(&mockEventStore{})
		agg := svc.NewApprovalAggregate()
		assert.NotNil(t, agg)
		assert.Equal(t, AggregateTypeApproval, agg.GetAggregateType())
	})

	t.Run("creates new feature flag aggregate", func(t *testing.T) {
		svc := NewAggregateService(&mockEventStore{})
		agg := svc.NewFeatureFlagAggregate()
		assert.NotNil(t, agg)
		assert.Equal(t, AggregateTypeFeatureFlag, agg.GetAggregateType())
	})
}

func TestAggregateService_Snapshot(t *testing.T) {
	t.Run("SaveSnapshot returns nil when snapshot store is nil", func(t *testing.T) {
		svc := NewAggregateService(&mockEventStore{})
		agg := svc.NewPipelineAggregate()
		err := svc.SaveSnapshot(context.Background(), agg)
		assert.NoError(t, err)
	})

	t.Run("ShouldSaveSnapshot returns false when snapshot disabled", func(t *testing.T) {
		svc := NewAggregateService(&mockEventStore{})
		agg := svc.NewPipelineAggregate()
		assert.False(t, svc.ShouldSaveSnapshot(agg))
	})

	t.Run("ShouldSaveSnapshot triggers at period boundary", func(t *testing.T) {
		snapshotStore := &mockSnapshotStore{}
		svc := NewAggregateServiceWithSnapshot(&mockEventStore{}, snapshotStore, 5)
		agg := svc.NewPipelineAggregate()
		agg.SetVersion(5)
		assert.True(t, svc.ShouldSaveSnapshot(agg))
		agg.SetVersion(6)
		assert.False(t, svc.ShouldSaveSnapshot(agg))
	})

	t.Run("SaveSnapshot persists to snapshot store", func(t *testing.T) {
		store := &mockEventStore{}
		store.Append(context.Background(),
			&testDomainEvent{aggregateID: "pipe-1", tenantID: "t1", eventType: "pipeline.created"},
		)

		snapshotStore := &mockSnapshotStore{}
		svc := NewAggregateServiceWithSnapshot(store, snapshotStore, 5)
		agg, err := svc.RebuildPipeline(context.Background(), "t1", "pipe-1")
		assert.NoError(t, err)

		err = svc.SaveSnapshot(context.Background(), agg)
		assert.NoError(t, err)
		assert.Len(t, snapshotStore.snapshots, 1)
		assert.Equal(t, "pipe-1", snapshotStore.snapshots[0].AggregateID)
	})

	t.Run("rebuild from snapshot skips replayed events", func(t *testing.T) {
		store := &mockEventStore{}
		store.Append(context.Background(),
			&testDomainEvent{aggregateID: "pipe-1", tenantID: "t1", eventType: "pipeline.created", version: 1},
		)

		snapshotStore := &mockSnapshotStore{}
		snapshotStore.Save(context.Background(), &eventstore.Snapshot{
			AggregateID:   "pipe-1",
			AggregateType: "pipeline",
			TenantID:      "t1",
			Version:       1,
			State:         `{"status":"DRAFT"}`,
		})

		svc := NewAggregateServiceWithSnapshot(store, snapshotStore, 5)
		agg, err := svc.RebuildPipeline(context.Background(), "t1", "pipe-1")
		assert.NoError(t, err)
		assert.NotNil(t, agg)
	})
}

// ---------------------------------------------------------------------------
// testDomainEvent — minimal DomainEvent implementation for tests
// ---------------------------------------------------------------------------

type testDomainEvent struct {
	aggregateType string
	aggregateID   string
	tenantID      string
	eventType     string
	occurredAt    time.Time
	version       int
}

func (e *testDomainEvent) AggregateType() string  { return e.aggregateType }
func (e *testDomainEvent) AggregateID() string    { return e.aggregateID }
func (e *testDomainEvent) TenantID() string       { return e.tenantID }
func (e *testDomainEvent) EventType() string      { return e.eventType }
func (e *testDomainEvent) OccurredAt() time.Time  { return e.occurredAt }
func (e *testDomainEvent) Version() int           { return e.version }
func (e *testDomainEvent) GetVersion() int        { return e.version }
func (e *testDomainEvent) SetVersion(v int)       { e.version = v }
func (e *testDomainEvent) SetAggregateID(id string) { e.aggregateID = id }
func (e *testDomainEvent) SetTenantID(id string)    { e.tenantID = id }

// Ensure testDomainEvent satisfies DomainEvent interface
var _ events.DomainEvent = (*testDomainEvent)(nil)