package connector

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Mock implementations ---

type mockCommandBus struct {
	dispatched int32
	lastCmd    atomic.Value // any
	err        error
}

func (m *mockCommandBus) Dispatch(ctx context.Context, cmd any) error {
	atomic.AddInt32(&m.dispatched, 1)
	m.lastCmd.Store(cmd)
	return m.err
}

type mockEventStore struct {
	appended int32
	lastEvent atomic.Value // BusinessEvent
	err      error
}

func (m *mockEventStore) Append(ctx context.Context, events ...any) error {
	atomic.AddInt32(&m.appended, int32(len(events)))
	if len(events) > 0 {
		m.lastEvent.Store(events[0])
	}
	return m.err
}

func (m *mockEventStore) GetStream(ctx context.Context, streamID string) ([]any, error) {
	return nil, nil
}

// --- Tests ---

func TestNewBusinessConnector(t *testing.T) {
	cb := &mockCommandBus{}
	es := &mockEventStore{}
	bc := NewBusinessConnector(cb, es)
	assert.NotNil(t, bc)
}

func TestProcessAlertEvent_DispatchesCommand(t *testing.T) {
	cb := &mockCommandBus{}
	bc := NewBusinessConnector(cb, nil)

	event := BusinessEvent{
		ID:        "evt-001",
		Type:      EventAlertTriggered,
		TenantID:  "tenant-1",
		Timestamp: time.Now(),
		Payload:   map[string]any{"severity": "critical"},
	}

	err := bc.ProcessAlertEvent(context.Background(), event)
	require.NoError(t, err)

	assert.Equal(t, int32(1), atomic.LoadInt32(&cb.dispatched))
	cmdStr := cb.lastCmd.Load().(string)
	assert.Equal(t, "alert.alert.triggered: evt-001", cmdStr)
}

func TestProcessAlertEvent_NilCommandBus_NoPanic(t *testing.T) {
	bc := NewBusinessConnector(nil, nil)

	event := BusinessEvent{
		ID:        "evt-002",
		Type:      EventAlertTriggered,
		TenantID:  "tenant-1",
		Timestamp: time.Now(),
	}

	err := bc.ProcessAlertEvent(context.Background(), event)
	require.NoError(t, err)
}

func TestProcessAlertEvent_CommandBusError(t *testing.T) {
	expectedErr := errors.New("bus unavailable")
	cb := &mockCommandBus{err: expectedErr}
	bc := NewBusinessConnector(cb, nil)

	event := BusinessEvent{
		ID:        "evt-003",
		Type:      EventAlertTriggered,
		TenantID:  "tenant-1",
		Timestamp: time.Now(),
	}

	err := bc.ProcessAlertEvent(context.Background(), event)
	assert.ErrorIs(t, err, expectedErr)
}

func TestProcessPipelineEvent_AppendsToStore(t *testing.T) {
	es := &mockEventStore{}
	bc := NewBusinessConnector(nil, es)

	event := BusinessEvent{
		ID:        "evt-004",
		Type:      EventPipelineComplete,
		TenantID:  "tenant-1",
		Timestamp: time.Now(),
		Payload:   map[string]any{"pipeline_id": "p-99"},
	}

	err := bc.ProcessPipelineEvent(context.Background(), event)
	require.NoError(t, err)

	assert.Equal(t, int32(1), atomic.LoadInt32(&es.appended))
	stored := es.lastEvent.Load().(BusinessEvent)
	assert.Equal(t, "evt-004", stored.ID)
	assert.Equal(t, EventPipelineComplete, stored.Type)
}

func TestProcessIncidentEvent_AppendsToStore(t *testing.T) {
	es := &mockEventStore{}
	bc := NewBusinessConnector(nil, es)

	event := BusinessEvent{
		ID:        "evt-005",
		Type:      EventIncidentCreated,
		TenantID:  "tenant-1",
		Timestamp: time.Now(),
		Payload:   map[string]any{"title": "db down"},
	}

	err := bc.ProcessIncidentEvent(context.Background(), event)
	require.NoError(t, err)

	assert.Equal(t, int32(1), atomic.LoadInt32(&es.appended))
}

func TestProcessPipelineEvent_NilEventStore_NoPanic(t *testing.T) {
	bc := NewBusinessConnector(nil, nil)

	event := BusinessEvent{
		ID:        "evt-006",
		Type:      EventPipelineComplete,
		TenantID:  "tenant-1",
		Timestamp: time.Now(),
	}

	err := bc.ProcessPipelineEvent(context.Background(), event)
	require.NoError(t, err)
}

func TestProcessEventStoreError(t *testing.T) {
	expectedErr := errors.New("store unavailable")
	es := &mockEventStore{err: expectedErr}
	bc := NewBusinessConnector(nil, es)

	event := BusinessEvent{
		ID:        "evt-007",
		Type:      EventIncidentCreated,
		TenantID:  "tenant-1",
		Timestamp: time.Now(),
	}

	err := bc.ProcessIncidentEvent(context.Background(), event)
	assert.ErrorIs(t, err, expectedErr)
}
