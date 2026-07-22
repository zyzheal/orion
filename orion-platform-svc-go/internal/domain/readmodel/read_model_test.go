package readmodel

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"orion/platform-svc-go/internal/domain/events"
)

// ---------------------------------------------------------------------------
// Mock event helpers
// ---------------------------------------------------------------------------

type mockPipelineEvent struct {
	events.BaseDomainEvent
	PipelineName    string `json:"pipeline_name,omitempty"`
	PipelineID      string `json:"pipeline_id,omitempty"`
	Branch          string `json:"branch,omitempty"`
	TriggerSource   string `json:"trigger_source,omitempty"`
	Status          string `json:"status,omitempty"`
	TotalDurationMs int64  `json:"total_duration_ms,omitempty"`
	Reason          string `json:"reason,omitempty"`
}

func newMockEvent(eventType, aggregateID, tenantID string, version int, extra map[string]string) events.DomainEvent {
	ev := &mockPipelineEvent{
		BaseDomainEvent: events.NewBaseDomainEvent("pipeline", aggregateID, eventType, tenantID, time.Now().UTC(), version),
	}
	for k, v := range extra {
		switch k {
		case "pipeline_name":
			ev.PipelineName = v
		case "pipeline_id":
			ev.PipelineID = v
		case "branch":
			ev.Branch = v
		case "trigger_source":
			ev.TriggerSource = v
		case "status":
			ev.Status = v
		case "reason":
			ev.Reason = v
		}
	}
	return ev
}

// ---------------------------------------------------------------------------
// Mock EventStoreReader
// ---------------------------------------------------------------------------

type mockEventStoreReader struct {
	eventsByType      map[string][]events.DomainEvent
	eventsByAggregate map[string][]events.DomainEvent
}

func newMockEventStoreReader() *mockEventStoreReader {
	return &mockEventStoreReader{
		eventsByType:      make(map[string][]events.DomainEvent),
		eventsByAggregate: make(map[string][]events.DomainEvent),
	}
}

func (m *mockEventStoreReader) addEvent(ev events.DomainEvent) {
	key := ev.AggregateType() + ":" + ev.AggregateID()
	m.eventsByAggregate[key] = append(m.eventsByAggregate[key], ev)
	m.eventsByType[ev.EventType()] = append(m.eventsByType[ev.EventType()], ev)
}

func (m *mockEventStoreReader) GetByAggregate(_ context.Context, _, _, aggregateID string) ([]events.DomainEvent, error) {
	// Return all events for this aggregate across all types
	var result []events.DomainEvent
	for _, evs := range m.eventsByType {
		for _, ev := range evs {
			if ev.AggregateID() == aggregateID {
				result = append(result, ev)
			}
		}
	}
	return result, nil
}

func (m *mockEventStoreReader) GetByType(_ context.Context, _, eventType string, _ time.Time) ([]events.DomainEvent, error) {
	return m.eventsByType[eventType], nil
}

func (m *mockEventStoreReader) GetEventsAfterVersion(_ context.Context, _, _, aggregateID string, afterVersion int) ([]events.DomainEvent, error) {
	var filtered []events.DomainEvent
	for _, evs := range m.eventsByType {
		for _, ev := range evs {
			if ev.AggregateID() == aggregateID && ev.Version() > afterVersion {
				filtered = append(filtered, ev)
			}
		}
	}
	return filtered, nil
}

func (m *mockEventStoreReader) GetLatestVersion(_ context.Context, _, _, aggregateID string) (int, error) {
	maxV := 0
	for _, evs := range m.eventsByType {
		for _, ev := range evs {
			if ev.AggregateID() == aggregateID && ev.Version() > maxV {
				maxV = ev.Version()
			}
		}
	}
	return maxV, nil
}

// ---------------------------------------------------------------------------
// In-memory projection store for testing
// ---------------------------------------------------------------------------

type inMemoryProjectionStore struct {
	mu   sync.Mutex
	runs map[string]*PipelineRunProjection
}

func newInMemoryProjectionStore() *inMemoryProjectionStore {
	return &inMemoryProjectionStore{runs: make(map[string]*PipelineRunProjection)}
}

func (s *inMemoryProjectionStore) upsert(proj *PipelineRunProjection) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.runs[proj.RunID] = proj
}

func (s *inMemoryProjectionStore) get(runID string) (*PipelineRunProjection, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.runs[runID]
	return p, ok
}

func (s *inMemoryProjectionStore) list() []*PipelineRunProjection {
	s.mu.Lock()
	defer s.mu.Unlock()
	result := make([]*PipelineRunProjection, 0, len(s.runs))
	for _, p := range s.runs {
		result = append(result, p)
	}
	return result
}

// ---------------------------------------------------------------------------
// InMemoryProjector — test-only projector that stores projections in memory
// ---------------------------------------------------------------------------

type InMemoryProjector struct {
	store  *inMemoryProjectionStore
	reader EventStoreReader
}

func NewInMemoryProjector(reader EventStoreReader) *InMemoryProjector {
	return &InMemoryProjector{
		store:  newInMemoryProjectionStore(),
		reader: reader,
	}
}

func (p *InMemoryProjector) Project(_ context.Context, event events.DomainEvent) error {
	switch event.EventType() {
	case "pipeline.created":
		proj := &PipelineRunProjection{
			RunID:      event.AggregateID(),
			PipelineID: event.AggregateID(),
			TenantID:   event.TenantID(),
			Status:     PipelineRunPending,
			Version:    event.Version(),
			UpdatedAt:  time.Now().UTC(),
		}
		if name := extractField(event, "pipeline_name"); name != "" {
			proj.PipelineName = name
		}
		p.store.upsert(proj)

	case "pipeline.started":
		proj := &PipelineRunProjection{
			RunID:         event.AggregateID(),
			PipelineID:    extractField(event, "pipeline_id"),
			TenantID:      event.TenantID(),
			Status:        PipelineRunRunning,
			Branch:        extractField(event, "branch"),
			TriggerSource: extractField(event, "trigger_source"),
			StartedAt:     timePtr(time.Now().UTC()),
			Version:       event.Version(),
			UpdatedAt:     time.Now().UTC(),
		}
		p.store.upsert(proj)

	case "pipeline.completed":
		status := PipelineRunSuccess
		if s := extractField(event, "status"); s == "failed" || s == "error" {
			status = PipelineRunFailed
		}
		existing, ok := p.store.get(event.AggregateID())
		if !ok {
			existing = &PipelineRunProjection{RunID: event.AggregateID(), TenantID: event.TenantID()}
		}
		existing.Status = status
		existing.CompletedAt = timePtr(time.Now().UTC())
		existing.TotalDurationMs = parseInt64Field(event, "total_duration_ms")
		existing.Version = event.Version()
		existing.UpdatedAt = time.Now().UTC()
		p.store.upsert(existing)

	case "pipeline.cancelled":
		existing, ok := p.store.get(event.AggregateID())
		if !ok {
			existing = &PipelineRunProjection{RunID: event.AggregateID(), TenantID: event.TenantID()}
		}
		existing.Status = PipelineRunCancelled
		existing.CompletedAt = timePtr(time.Now().UTC())
		existing.ErrorMessage = extractField(event, "reason")
		existing.Version = event.Version()
		existing.UpdatedAt = time.Now().UTC()
		p.store.upsert(existing)
	}
	return nil
}

func (p *InMemoryProjector) Rebuild(ctx context.Context, since time.Time) error {
	p.store = newInMemoryProjectionStore()

	eventTypes := []string{"pipeline.created", "pipeline.started", "pipeline.completed", "pipeline.cancelled"}
	for _, et := range eventTypes {
		evs, err := p.reader.GetByType(ctx, "", et, since)
		if err != nil {
			return err
		}
		for _, ev := range evs {
			if err := p.Project(ctx, ev); err != nil {
				return err
			}
		}
	}
	return nil
}

func (p *InMemoryProjector) GetRun(runID string) (*PipelineRunProjection, bool) {
	return p.store.get(runID)
}

func (p *InMemoryProjector) GetAllRuns() []*PipelineRunProjection {
	return p.store.list()
}

func timePtr(t time.Time) *time.Time {
	return &t
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

func TestInMemoryProjector_PipelineLifecycle(t *testing.T) {
	reader := newMockEventStoreReader()
	proj := NewInMemoryProjector(reader)
	ctx := context.Background()

	// 1. Pipeline created
	created := newMockEvent("pipeline.created", "run-1", "tenant-1", 1, map[string]string{
		"pipeline_name": "My Pipeline",
	})
	err := proj.Project(ctx, created)
	require.NoError(t, err)

	run, ok := proj.GetRun("run-1")
	require.True(t, ok)
	assert.Equal(t, PipelineRunPending, run.Status)
	assert.Equal(t, "My Pipeline", run.PipelineName)

	// 2. Pipeline started
	started := newMockEvent("pipeline.started", "run-1", "tenant-1", 2, map[string]string{
		"pipeline_id":   "pipe-1",
		"branch":        "main",
		"trigger_source": "manual",
	})
	err = proj.Project(ctx, started)
	require.NoError(t, err)

	run, ok = proj.GetRun("run-1")
	require.True(t, ok)
	assert.Equal(t, PipelineRunRunning, run.Status)
	assert.Equal(t, "main", run.Branch)
	assert.Equal(t, "manual", run.TriggerSource)
	assert.NotNil(t, run.StartedAt)

	// 3. Pipeline completed successfully
	completed := newMockEvent("pipeline.completed", "run-1", "tenant-1", 3, map[string]string{
		"status": "success",
	})
	err = proj.Project(ctx, completed)
	require.NoError(t, err)

	run, ok = proj.GetRun("run-1")
	require.True(t, ok)
	assert.Equal(t, PipelineRunSuccess, run.Status)
	assert.NotNil(t, run.CompletedAt)
}

func TestInMemoryProjector_PipelineFailed(t *testing.T) {
	reader := newMockEventStoreReader()
	proj := NewInMemoryProjector(reader)
	ctx := context.Background()

	proj.Project(ctx, newMockEvent("pipeline.created", "run-2", "tenant-1", 1, map[string]string{"pipeline_name": "Fail Pipeline"}))
	proj.Project(ctx, newMockEvent("pipeline.started", "run-2", "tenant-1", 2, nil))

	completed := newMockEvent("pipeline.completed", "run-2", "tenant-1", 3, map[string]string{
		"status": "failed",
	})
	err := proj.Project(ctx, completed)
	require.NoError(t, err)

	run, ok := proj.GetRun("run-2")
	require.True(t, ok)
	assert.Equal(t, PipelineRunFailed, run.Status)
}

func TestInMemoryProjector_PipelineCancelled(t *testing.T) {
	reader := newMockEventStoreReader()
	proj := NewInMemoryProjector(reader)
	ctx := context.Background()

	proj.Project(ctx, newMockEvent("pipeline.created", "run-3", "tenant-1", 1, nil))
	proj.Project(ctx, newMockEvent("pipeline.started", "run-3", "tenant-1", 2, nil))

	cancelled := newMockEvent("pipeline.cancelled", "run-3", "tenant-1", 3, map[string]string{
		"reason": "User cancelled",
	})
	err := proj.Project(ctx, cancelled)
	require.NoError(t, err)

	run, ok := proj.GetRun("run-3")
	require.True(t, ok)
	assert.Equal(t, PipelineRunCancelled, run.Status)
	assert.Equal(t, "User cancelled", run.ErrorMessage)
}

func TestInMemoryProjector_UnknownEventType(t *testing.T) {
	reader := newMockEventStoreReader()
	proj := NewInMemoryProjector(reader)

	unknown := newMockEvent("pipeline.unknown", "run-x", "tenant-1", 1, nil)
	err := proj.Project(context.Background(), unknown)
	assert.NoError(t, err, "unknown event types should be silently ignored")
}

func TestInMemoryProjector_Rebuild(t *testing.T) {
	reader := newMockEventStoreReader()
	ctx := context.Background()

	// Add events to the mock store
	reader.addEvent(newMockEvent("pipeline.created", "run-1", "tenant-1", 1, map[string]string{"pipeline_name": "First"}))
	reader.addEvent(newMockEvent("pipeline.started", "run-1", "tenant-1", 2, map[string]string{"pipeline_id": "pipe-1", "branch": "main"}))
	reader.addEvent(newMockEvent("pipeline.completed", "run-1", "tenant-1", 3, map[string]string{"status": "success"}))
	reader.addEvent(newMockEvent("pipeline.created", "run-2", "tenant-1", 1, map[string]string{"pipeline_name": "Second"}))
	reader.addEvent(newMockEvent("pipeline.cancelled", "run-2", "tenant-1", 2, map[string]string{"reason": "Cancelled"}))

	proj := NewInMemoryProjector(reader)
	err := proj.Rebuild(ctx, time.Time{})
	require.NoError(t, err)

	runs := proj.GetAllRuns()
	assert.Len(t, runs, 2)

	run1, ok := proj.GetRun("run-1")
	require.True(t, ok)
	assert.Equal(t, PipelineRunSuccess, run1.Status)

	run2, ok := proj.GetRun("run-2")
	require.True(t, ok)
	assert.Equal(t, PipelineRunCancelled, run2.Status)
	assert.Equal(t, "Cancelled", run2.ErrorMessage)
}

func TestExtractField(t *testing.T) {
	ev := newMockEvent("pipeline.created", "run-1", "tenant-1", 1, map[string]string{
		"pipeline_name": "My Pipeline",
		"branch":        "main",
	})

	assert.Equal(t, "My Pipeline", extractField(ev, "pipeline_name"))
	assert.Equal(t, "main", extractField(ev, "branch"))
	assert.Equal(t, "", extractField(ev, "nonexistent"))
}

func TestParseInt64Field(t *testing.T) {
	// Create an event with a duration using raw JSON
	ev := &mockPipelineEvent{
		BaseDomainEvent: events.NewBaseDomainEvent("pipeline", "run-1", "pipeline.completed", "tenant-1", time.Now().UTC(), 2),
		TotalDurationMs: 1500,
	}
	duration := parseInt64Field(ev, "total_duration_ms")
	assert.Equal(t, int64(1500), duration)

	// Non-existent field
	assert.Equal(t, int64(0), parseInt64Field(ev, "nonexistent"))
}

func TestErrProjectionNotFound(t *testing.T) {
	assert.True(t, errors.Is(ErrProjectionNotFound, ErrProjectionNotFound))
	assert.Contains(t, ErrProjectionNotFound.Error(), "not found")
}

func TestErrProjectionAlreadyExists(t *testing.T) {
	assert.True(t, errors.Is(ErrProjectionAlreadyExists, ErrProjectionAlreadyExists))
	assert.Contains(t, ErrProjectionAlreadyExists.Error(), "already exists")
}

func TestPipelineRunStatus_Constants(t *testing.T) {
	assert.Equal(t, PipelineRunStatus("pending"), PipelineRunPending)
	assert.Equal(t, PipelineRunStatus("running"), PipelineRunRunning)
	assert.Equal(t, PipelineRunStatus("success"), PipelineRunSuccess)
	assert.Equal(t, PipelineRunStatus("failed"), PipelineRunFailed)
	assert.Equal(t, PipelineRunStatus("cancelled"), PipelineRunCancelled)
}

func TestInMemoryProjector_DurationTracking(t *testing.T) {
	reader := newMockEventStoreReader()
	proj := NewInMemoryProjector(reader)
	ctx := context.Background()

	proj.Project(ctx, newMockEvent("pipeline.created", "run-dur", "tenant-1", 1, nil))
	proj.Project(ctx, newMockEvent("pipeline.started", "run-dur", "tenant-1", 2, nil))

	// Create a completed event with a duration
	ev := &mockPipelineEvent{
		BaseDomainEvent: events.NewBaseDomainEvent("pipeline", "run-dur", "pipeline.completed", "tenant-1", time.Now().UTC(), 3),
		Status:          "success",
		TotalDurationMs: 4500,
	}
	err := proj.Project(ctx, ev)
	require.NoError(t, err)

	run, ok := proj.GetRun("run-dur")
	require.True(t, ok)
	assert.Equal(t, PipelineRunSuccess, run.Status)
	assert.Equal(t, int64(4500), run.TotalDurationMs)
}

func TestInMemoryProjector_MultiTenantIsolation(t *testing.T) {
	reader := newMockEventStoreReader()
	proj := NewInMemoryProjector(reader)
	ctx := context.Background()

	proj.Project(ctx, newMockEvent("pipeline.created", "run-1", "tenant-a", 1, map[string]string{"pipeline_name": "A"}))
	proj.Project(ctx, newMockEvent("pipeline.created", "run-2", "tenant-b", 1, map[string]string{"pipeline_name": "B"}))

	runA, ok := proj.GetRun("run-1")
	require.True(t, ok)
	assert.Equal(t, "tenant-a", runA.TenantID)

	runB, ok := proj.GetRun("run-2")
	require.True(t, ok)
	assert.Equal(t, "tenant-b", runB.TenantID)
}

func TestNewPostgresReadModelProjector(t *testing.T) {
	// Verify constructor returns a non-nil projector.
	proj := NewPostgresReadModelProjector(nil, nil)
	assert.NotNil(t, proj)

	// EnsureSchema requires a real PostgreSQL connection.
	// Integration tests with a real DB belong in a separate test suite.
	assert.Panics(t, func() {
		proj := &PostgresReadModelProjector{}
		_ = proj.EnsureSchema(context.Background())
	}, "EnsureSchema should panic with nil db")
}

func TestEventStoreReaderInterface(t *testing.T) {
	// Compile-time check that mockEventStoreReader satisfies EventStoreReader.
	var _ EventStoreReader = (*mockEventStoreReader)(nil)
}

func TestPipelineRunProjection_JSONSerialization(t *testing.T) {
	now := time.Now().UTC()
	proj := PipelineRunProjection{
		RunID:         "run-1",
		PipelineID:    "pipe-1",
		PipelineName:  "Test Pipeline",
		TenantID:      "tenant-1",
		Status:        PipelineRunRunning,
		Branch:        "main",
		TriggerSource: "manual",
		StartedAt:     &now,
		Version:       3,
		UpdatedAt:     now,
	}

	data, err := json.Marshal(proj)
	require.NoError(t, err)

	var decoded PipelineRunProjection
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)
	assert.Equal(t, proj.RunID, decoded.RunID)
	assert.Equal(t, proj.Status, decoded.Status)
}

func TestProjectionRepositoryInterface(t *testing.T) {
	// Compile-time check that the interface is well-defined.
	var _ ProjectionRepository = (*mockProjectionRepo)(nil)
}

type mockProjectionRepo struct{}

func (m *mockProjectionRepo) FindByID(_ context.Context, _ string) (interface{}, error) {
	return nil, nil
}
func (m *mockProjectionRepo) List(_ context.Context, _ string) ([]interface{}, error) {
	return nil, nil
}
func (m *mockProjectionRepo) Save(_ context.Context, _ interface{}) error {
	return nil
}
func (m *mockProjectionRepo) Delete(_ context.Context, _ string) error {
	return nil
}

// Ensure full test coverage for the mockProjectionRepo
func TestMockProjectionRepo(t *testing.T) {
	repo := &mockProjectionRepo{}
	ctx := context.Background()
	val, err := repo.FindByID(ctx, "test")
	assert.NoError(t, err)
	assert.Nil(t, val)

	list, err := repo.List(ctx, "test")
	assert.NoError(t, err)
	assert.Nil(t, list)

	err = repo.Save(ctx, nil)
	assert.NoError(t, err)

	err = repo.Delete(ctx, "test")
	assert.NoError(t, err)
}

// Ensure the mock event store reader also exercises the empty path
func TestMockEventStoreReader_Empty(t *testing.T) {
	reader := newMockEventStoreReader()
	ctx := context.Background()

	evs, err := reader.GetByAggregate(ctx, "t", "p", "nonexistent")
	assert.NoError(t, err)
	assert.Len(t, evs, 0)

	evs, err = reader.GetByType(ctx, "t", "nonexistent", time.Time{})
	assert.NoError(t, err)
	assert.Len(t, evs, 0)

	evs, err = reader.GetEventsAfterVersion(ctx, "t", "p", "nonexistent", 0)
	assert.NoError(t, err)
	assert.Len(t, evs, 0)

	v, err := reader.GetLatestVersion(ctx, "t", "p", "nonexistent")
	assert.NoError(t, err)
	assert.Equal(t, 0, v)
}

// Test for the InMemoryProjector's Rebuild with no events
func TestInMemoryProjector_RebuildEmpty(t *testing.T) {
	reader := newMockEventStoreReader()
	proj := NewInMemoryProjector(reader)

	err := proj.Rebuild(context.Background(), time.Time{})
	assert.NoError(t, err)

	runs := proj.GetAllRuns()
	assert.Len(t, runs, 0)
}

// Test that the InMemoryProjector handles started event creating a new projection
// (when no prior created event exists)
func TestInMemoryProjector_StartedWithoutCreated(t *testing.T) {
	reader := newMockEventStoreReader()
	proj := NewInMemoryProjector(reader)
	ctx := context.Background()

	started := newMockEvent("pipeline.started", "run-direct", "tenant-1", 1, map[string]string{
		"pipeline_id": "pipe-1",
		"branch":      "main",
	})
	err := proj.Project(ctx, started)
	require.NoError(t, err)

	run, ok := proj.GetRun("run-direct")
	require.True(t, ok)
	assert.Equal(t, PipelineRunRunning, run.Status)
}

// Test that the InMemoryProjector handles completed event creating a new projection
// (when no prior events exist)
func TestInMemoryProjector_CompletedWithoutPrior(t *testing.T) {
	reader := newMockEventStoreReader()
	proj := NewInMemoryProjector(reader)
	ctx := context.Background()

	completed := newMockEvent("pipeline.completed", "run-orphan", "tenant-1", 1, map[string]string{
		"status": "success",
	})
	err := proj.Project(ctx, completed)
	require.NoError(t, err)

	run, ok := proj.GetRun("run-orphan")
	require.True(t, ok)
	assert.Equal(t, PipelineRunSuccess, run.Status)
}

// Test that the InMemoryProjector handles cancelled event creating a new projection
// (when no prior events exist)
func TestInMemoryProjector_CancelledWithoutPrior(t *testing.T) {
	reader := newMockEventStoreReader()
	proj := NewInMemoryProjector(reader)
	ctx := context.Background()

	cancelled := newMockEvent("pipeline.cancelled", "run-orphan-cancel", "tenant-1", 1, map[string]string{
		"reason": "Manual cancel",
	})
	err := proj.Project(ctx, cancelled)
	require.NoError(t, err)

	run, ok := proj.GetRun("run-orphan-cancel")
	require.True(t, ok)
	assert.Equal(t, PipelineRunCancelled, run.Status)
	assert.Equal(t, "Manual cancel", run.ErrorMessage)
}