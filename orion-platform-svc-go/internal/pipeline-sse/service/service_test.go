package service

import (
	"context"
	"testing"

	"orion/platform-svc-go/internal/pipeline-sse/models"
)

// --- mock repository ---

type mockRepo struct {
	createLogErr    error
	createStatusErr error
	listEventsFn    func(ctx context.Context, pipelineID, runID string, limit int) ([]map[string]interface{}, error)
}

func (m *mockRepo) CreateLogEvent(ctx context.Context, tenantID string, event *models.PublishLogRequest) error {
	return m.createLogErr
}

func (m *mockRepo) CreateStatusEvent(ctx context.Context, tenantID string, event *models.PublishStatusRequest) error {
	return m.createStatusErr
}

func (m *mockRepo) ListEvents(ctx context.Context, pipelineID, runID string, limit int) ([]map[string]interface{}, error) {
	if m.listEventsFn != nil {
		return m.listEventsFn(ctx, pipelineID, runID, limit)
	}
	return []map[string]interface{}{}, nil
}

// newTestHub creates an SSEHub with a mock repository.
func newTestHub(repo Repository) *SSEHub {
	return &SSEHub{
		connections: make(map[string]*models.SSEConnection),
		repo:        repo,
	}
}

// --- tests ---

func TestCreateConnection(t *testing.T) {
	h := newTestHub(nil)
	connID := h.CreateConnection("pipeline-1", "run-1", "user-1", []string{"info", "error"}, true, false)

	if connID == "" {
		t.Fatal("expected non-empty connection ID")
	}

	conn := h.GetConnection(connID)
	if conn == nil {
		t.Fatal("expected connection to exist")
	}
	if conn.PipelineID != "pipeline-1" {
		t.Errorf("expected pipeline-1, got %s", conn.PipelineID)
	}
	if conn.RunID != "run-1" {
		t.Errorf("expected run-1, got %s", conn.RunID)
	}
	if conn.UserID != "user-1" {
		t.Errorf("expected user-1, got %s", conn.UserID)
	}
	if !conn.IncludeLogs {
		t.Error("expected IncludeLogs=true")
	}
	if conn.IncludeStatus {
		t.Error("expected IncludeStatus=false")
	}
	if len(conn.LogLevels) != 2 || conn.LogLevels[0] != "info" || conn.LogLevels[1] != "error" {
		t.Errorf("expected [info error], got %v", conn.LogLevels)
	}
}

func TestCreateConnection_NilLogLevels(t *testing.T) {
	h := newTestHub(nil)
	connID := h.CreateConnection("pipeline-1", "run-1", "user-1", nil, false, true)

	conn := h.GetConnection(connID)
	if conn == nil {
		t.Fatal("expected connection to exist")
	}
	if conn.IncludeLogs {
		t.Error("expected IncludeLogs=false")
	}
	if !conn.IncludeStatus {
		t.Error("expected IncludeStatus=true")
	}
	// Nil logLevels should be converted to empty slice
	if conn.LogLevels == nil {
		t.Error("expected non-nil LogLevels")
	}
	if len(conn.LogLevels) != 0 {
		t.Errorf("expected empty LogLevels, got %v", conn.LogLevels)
	}
}

func TestRemoveConnection(t *testing.T) {
	h := newTestHub(nil)
	connID := h.CreateConnection("pipeline-1", "run-1", "user-1", nil, true, false)

	h.RemoveConnection(connID)
	if conn := h.GetConnection(connID); conn != nil {
		t.Error("expected connection to be removed")
	}
}

func TestGetStats_Empty(t *testing.T) {
	h := newTestHub(nil)
	stats := h.GetStats()

	if stats.TotalConnections != 0 {
		t.Errorf("expected 0 connections, got %d", stats.TotalConnections)
	}
	if len(stats.ConnectionsByUser) != 0 {
		t.Errorf("expected empty ConnectionsByUser, got %v", stats.ConnectionsByUser)
	}
}

func TestGetStats_MultipleConnections(t *testing.T) {
	h := newTestHub(nil)
	h.CreateConnection("p-1", "r-1", "user-1", nil, true, false)
	h.CreateConnection("p-2", "r-2", "user-1", nil, true, false)
	h.CreateConnection("p-3", "r-3", "user-2", nil, false, true)

	stats := h.GetStats()
	if stats.TotalConnections != 3 {
		t.Errorf("expected 3 connections, got %d", stats.TotalConnections)
	}
	if stats.ConnectionsByUser["user-1"] != 2 {
		t.Errorf("expected 2 for user-1, got %d", stats.ConnectionsByUser["user-1"])
	}
	if stats.ConnectionsByUser["user-2"] != 1 {
		t.Errorf("expected 1 for user-2, got %d", stats.ConnectionsByUser["user-2"])
	}
}

func TestPublishLogEvent_Success(t *testing.T) {
	h := newTestHub(&mockRepo{})
	connID := h.CreateConnection("pipeline-1", "run-1", "user-1", []string{"error"}, true, false)
	_ = connID // connection exists for broadcasting

	err := h.PublishLogEvent(context.Background(), "tenant-1", &models.PublishLogRequest{
		PipelineID: "pipeline-1",
		RunID:      "run-1",
		StageID:    "stage-1",
		LogLine:    "test log line",
		Level:      "info",
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
}

func TestPublishLogEvent_RepoError(t *testing.T) {
	h := newTestHub(&mockRepo{
		createLogErr: assertError("db error"),
	})

	err := h.PublishLogEvent(context.Background(), "tenant-1", &models.PublishLogRequest{
		PipelineID: "pipeline-1",
		RunID:      "run-1",
		LogLine:    "test",
	})
	if err == nil {
		t.Fatal("expected error from repo")
	}
	if err.Error() != "db error" {
		t.Errorf("expected 'db error', got %v", err)
	}
}

func TestPublishLogEvent_WithNilRepo(t *testing.T) {
	h := &SSEHub{
		connections: make(map[string]*models.SSEConnection),
		repo:        nil,
	}
	h.CreateConnection("pipeline-1", "run-1", "user-1", nil, true, false)

	err := h.PublishLogEvent(context.Background(), "tenant-1", &models.PublishLogRequest{
		PipelineID: "pipeline-1",
		RunID:      "run-1",
		LogLine:    "test",
	})
	if err != nil {
		t.Fatalf("expected no error with nil repo, got %v", err)
	}
}

func TestPublishStatusEvent_Success(t *testing.T) {
	h := newTestHub(&mockRepo{})
	h.CreateConnection("pipeline-1", "run-1", "user-1", nil, false, true)

	err := h.PublishStatusEvent(context.Background(), "tenant-1", &models.PublishStatusRequest{
		PipelineID: "pipeline-1",
		RunID:      "run-1",
		Status:     "completed",
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
}

func TestPublishStatusEvent_RepoError(t *testing.T) {
	h := newTestHub(&mockRepo{
		createStatusErr: assertError("db error"),
	})

	err := h.PublishStatusEvent(context.Background(), "tenant-1", &models.PublishStatusRequest{
		PipelineID: "pipeline-1",
		RunID:      "run-1",
		Status:     "completed",
	})
	if err == nil {
		t.Fatal("expected error from repo")
	}
	if err.Error() != "db error" {
		t.Errorf("expected 'db error', got %v", err)
	}
}

func TestListEvents_DelegatesToRepo(t *testing.T) {
	called := false
	h := newTestHub(&mockRepo{
		listEventsFn: func(_ context.Context, pipelineID, runID string, limit int) ([]map[string]interface{}, error) {
			called = true
			if pipelineID != "pipeline-1" {
				t.Errorf("expected pipeline-1, got %s", pipelineID)
			}
			if limit != 100 {
				t.Errorf("expected limit 100, got %d", limit)
			}
			return []map[string]interface{}{
				{"id": "event-1"},
			}, nil
		},
	})

	events, err := h.ListEvents(context.Background(), "pipeline-1", "run-1", 100)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if !called {
		t.Error("expected ListEvents to delegate to repo")
	}
	if len(events) != 1 {
		t.Errorf("expected 1 event, got %d", len(events))
	}
}

func TestListEvents_NilRepo(t *testing.T) {
	h := &SSEHub{
		connections: make(map[string]*models.SSEConnection),
		repo:        nil,
	}

	events, err := h.ListEvents(context.Background(), "pipeline-1", "run-1", 100)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(events) != 0 {
		t.Errorf("expected 0 events, got %d", len(events))
	}
}

func TestShutdown(t *testing.T) {
	h := newTestHub(nil)
	h.CreateConnection("pipeline-1", "run-1", "user-1", nil, true, false)
	h.CreateConnection("pipeline-2", "run-2", "user-2", nil, false, true)

	if stats := h.GetStats(); stats.TotalConnections != 2 {
		t.Fatalf("expected 2 connections before shutdown, got %d", stats.TotalConnections)
	}

	h.Shutdown()

	if stats := h.GetStats(); stats.TotalConnections != 0 {
		t.Errorf("expected 0 connections after shutdown, got %d", stats.TotalConnections)
	}
}

func TestBroadcastToNoMatchingConnections(t *testing.T) {
	h := newTestHub(nil)
	h.CreateConnection("pipeline-1", "run-1", "user-1", nil, true, false)

	// No error if broadcasting to a pipeline/run with no matching connections
	err := h.PublishLogEvent(context.Background(), "tenant-1", &models.PublishLogRequest{
		PipelineID: "other-pipeline",
		RunID:      "other-run",
		LogLine:    "test",
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
}

// --- helpers ---

// assertError is a simple error type for testing.
type assertError string

func (e assertError) Error() string { return string(e) }
