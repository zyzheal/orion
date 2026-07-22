package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"orion/platform-svc-go/internal/pipeline-sse/models"

	"github.com/gin-gonic/gin"
)

// --- mock Hub ---

type mockHub struct {
	createConnectionFn func(pipelineID, runID, userID string, logLevels []string, includeLogs, includeStatus bool) string
	streamLogEventsFn  func(c *gin.Context, connID string)
	streamStatusFn     func(c *gin.Context, connID string)
	publishLogFn       func(ctx context.Context, tenantID string, event *models.PublishLogRequest) error
	publishStatusFn    func(ctx context.Context, tenantID string, event *models.PublishStatusRequest) error
	getStatsFn         func() *models.SSEStats
	listEventsFn  func(ctx context.Context, tenantID, pipelineID, runID string, limit int) ([]map[string]interface{}, error)
}

func (m *mockHub) CreateConnection(pipelineID, runID, userID string, logLevels []string, includeLogs, includeStatus bool) string {
	if m.createConnectionFn != nil {
		return m.createConnectionFn(pipelineID, runID, userID, logLevels, includeLogs, includeStatus)
	}
	return "mock-conn-id"
}

func (m *mockHub) StreamLogEvents(c *gin.Context, connID string) {
	if m.streamLogEventsFn != nil {
		m.streamLogEventsFn(c, connID)
	}
}

func (m *mockHub) StreamStatusEvents(c *gin.Context, connID string) {
	if m.streamStatusFn != nil {
		m.streamStatusFn(c, connID)
	}
}

func (m *mockHub) PublishLogEvent(ctx context.Context, tenantID string, event *models.PublishLogRequest) error {
	if m.publishLogFn != nil {
		return m.publishLogFn(ctx, tenantID, event)
	}
	return nil
}

func (m *mockHub) PublishStatusEvent(ctx context.Context, tenantID string, event *models.PublishStatusRequest) error {
	if m.publishStatusFn != nil {
		return m.publishStatusFn(ctx, tenantID, event)
	}
	return nil
}

func (m *mockHub) GetStats() *models.SSEStats {
	if m.getStatsFn != nil {
		return m.getStatsFn()
	}
	return &models.SSEStats{
		TotalConnections:  0,
		ConnectionsByUser: map[string]int{},
	}
}

func (m *mockHub) ListEvents(ctx context.Context, tenantID, pipelineID, runID string, limit int) ([]map[string]interface{}, error) {
	if m.listEventsFn != nil {
		return m.listEventsFn(ctx, tenantID, pipelineID, runID, limit)
	}
	return []map[string]interface{}{}, nil
}

// --- test helpers ---

func setupTest(t *testing.T, hub Hub) (*gin.Context, *httptest.ResponseRecorder, *Handler) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	h := NewHandler(hub)
	return c, w, h
}

func setTenant(c *gin.Context, tenantID string) {
	c.Set("tenant_id", tenantID)
}

func setUser(c *gin.Context, userID string) {
	c.Set("user_id", userID)
}

// responseEnvelope mirrors the canonical success envelope from go-common/pkg/errors.
type responseEnvelope struct {
	Success bool            `json:"success"`
	Data    json.RawMessage `json:"data"`
	Error   string          `json:"error"`
	Code    string          `json:"code"`
}

// extractSuccessData unmarshals the canonical success envelope and returns the data field.
func extractSuccessData(t *testing.T, w *httptest.ResponseRecorder) []byte {
	t.Helper()
	var env responseEnvelope
	if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
		t.Fatalf("failed to parse response envelope: %v", err)
	}
	if !env.Success {
		t.Fatalf("expected success=true in envelope, got error=%q code=%q", env.Error, env.Code)
	}
	return env.Data
}

// --- tests ---

func TestStreamLogs_Success(t *testing.T) {
	streamCalled := false
	hub := &mockHub{
		createConnectionFn: func(_, _, _ string, _ []string, _, _ bool) string {
			return "conn-1"
		},
		streamLogEventsFn: func(_ *gin.Context, connID string) {
			if connID != "conn-1" {
				t.Errorf("expected conn-1, got %s", connID)
			}
			streamCalled = true
		},
	}
	c, w, h := setupTest(t, hub)
	setUser(c, "user-1")
	c.Request = httptest.NewRequest("GET", "/pipelines/sse/logs?pipelineId=p-1&runId=r-1", nil)

	h.StreamLogs(c)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
	if !streamCalled {
		t.Error("expected StreamLogEvents to be called")
	}
	if w.Header().Get("Content-Type") != "text/event-stream" {
		t.Errorf("expected Content-Type text/event-stream, got %s", w.Header().Get("Content-Type"))
	}
}

func TestStreamLogs_MissingParams(t *testing.T) {
	tests := []struct {
		name string
		url  string
	}{
		{"missing pipelineId", "/pipelines/sse/logs?runId=r-1"},
		{"missing runId", "/pipelines/sse/logs?pipelineId=p-1"},
		{"both missing", "/pipelines/sse/logs"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, w, h := setupTest(t, &mockHub{})
			c.Request = httptest.NewRequest("GET", tt.url, nil)

			h.StreamLogs(c)

			if w.Code != http.StatusBadRequest {
				t.Errorf("expected 400, got %d", w.Code)
			}
		})
	}
}

func TestStreamStatus_Success(t *testing.T) {
	streamCalled := false
	hub := &mockHub{
		createConnectionFn: func(_, _, _ string, _ []string, _, _ bool) string {
			return "conn-1"
		},
		streamStatusFn: func(_ *gin.Context, connID string) {
			if connID != "conn-1" {
				t.Errorf("expected conn-1, got %s", connID)
			}
			streamCalled = true
		},
	}
	c, w, h := setupTest(t, hub)
	setUser(c, "user-1")
	c.Request = httptest.NewRequest("GET", "/pipelines/sse/status?pipelineId=p-1&runId=r-1", nil)

	h.StreamStatus(c)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
	if !streamCalled {
		t.Error("expected StreamStatusEvents to be called")
	}
	if w.Header().Get("Content-Type") != "text/event-stream" {
		t.Errorf("expected Content-Type text/event-stream, got %s", w.Header().Get("Content-Type"))
	}
}

func TestStreamStatus_MissingParams(t *testing.T) {
	tests := []struct {
		name string
		url  string
	}{
		{"missing pipelineId", "/pipelines/sse/status?runId=r-1"},
		{"missing runId", "/pipelines/sse/status?pipelineId=p-1"},
		{"both missing", "/pipelines/sse/status"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, w, h := setupTest(t, &mockHub{})
			c.Request = httptest.NewRequest("GET", tt.url, nil)

			h.StreamStatus(c)

			if w.Code != http.StatusBadRequest {
				t.Errorf("expected 400, got %d", w.Code)
			}
		})
	}
}

func TestPublishLog_Success(t *testing.T) {
	publishCalled := false
	hub := &mockHub{
		publishLogFn: func(_ context.Context, tenantID string, event *models.PublishLogRequest) error {
			publishCalled = true
			if tenantID != "tenant-1" {
				t.Errorf("expected tenant-1, got %s", tenantID)
			}
			if event.PipelineID != "p-1" {
				t.Errorf("expected p-1, got %s", event.PipelineID)
			}
			if event.LogLine != "test log" {
				t.Errorf("expected 'test log', got %s", event.LogLine)
			}
			return nil
		},
	}
	c, w, h := setupTest(t, hub)
	setTenant(c, "tenant-1")
	body := `{"pipelineId":"p-1","runId":"r-1","logLine":"test log"}`
	c.Request = httptest.NewRequest("POST", "/pipelines/sse/publish/log", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")

	h.PublishLog(c)

	if !publishCalled {
		t.Error("expected PublishLogEvent to be called")
	}
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	data := extractSuccessData(t, w)
	var msg struct {
		Message string `json:"message"`
	}
	if err := json.Unmarshal(data, &msg); err != nil {
		t.Fatalf("failed to parse data: %v", err)
	}
	if msg.Message != "log event published" {
		t.Errorf("expected log event published, got %s", msg.Message)
	}
}

func TestPublishLog_InvalidBody(t *testing.T) {
	c, w, h := setupTest(t, &mockHub{})
	setTenant(c, "tenant-1")
	// Missing required fields (pipelineId, runId, logLine)
	body := `{"stageId":"s-1"}`
	c.Request = httptest.NewRequest("POST", "/pipelines/sse/publish/log", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")

	h.PublishLog(c)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestPublishLog_HubError(t *testing.T) {
	hub := &mockHub{
		publishLogFn: func(_ context.Context, _ string, _ *models.PublishLogRequest) error {
			return assertError("hub error")
		},
	}
	c, w, h := setupTest(t, hub)
	setTenant(c, "tenant-1")
	body := `{"pipelineId":"p-1","runId":"r-1","logLine":"test"}`
	c.Request = httptest.NewRequest("POST", "/pipelines/sse/publish/log", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")

	h.PublishLog(c)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}
}

func TestPublishStatus_Success(t *testing.T) {
	publishCalled := false
	hub := &mockHub{
		publishStatusFn: func(_ context.Context, tenantID string, event *models.PublishStatusRequest) error {
			publishCalled = true
			if tenantID != "tenant-1" {
				t.Errorf("expected tenant-1, got %s", tenantID)
			}
			if event.Status != "completed" {
				t.Errorf("expected 'completed', got %s", event.Status)
			}
			return nil
		},
	}
	c, w, h := setupTest(t, hub)
	setTenant(c, "tenant-1")
	body := `{"pipelineId":"p-1","runId":"r-1","status":"completed"}`
	c.Request = httptest.NewRequest("POST", "/pipelines/sse/publish/status", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")

	h.PublishStatus(c)

	if !publishCalled {
		t.Error("expected PublishStatusEvent to be called")
	}
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	data := extractSuccessData(t, w)
	var msg struct {
		Message string `json:"message"`
	}
	if err := json.Unmarshal(data, &msg); err != nil {
		t.Fatalf("failed to parse data: %v", err)
	}
	if msg.Message != "status event published" {
		t.Errorf("expected status event published, got %s", msg.Message)
	}
}

func TestPublishStatus_InvalidBody(t *testing.T) {
	c, w, h := setupTest(t, &mockHub{})
	setTenant(c, "tenant-1")
	// Missing required fields
	body := `{"pipelineId":"p-1"}`
	c.Request = httptest.NewRequest("POST", "/pipelines/sse/publish/status", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")

	h.PublishStatus(c)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestPublishStatus_HubError(t *testing.T) {
	hub := &mockHub{
		publishStatusFn: func(_ context.Context, _ string, _ *models.PublishStatusRequest) error {
			return assertError("hub error")
		},
	}
	c, w, h := setupTest(t, hub)
	setTenant(c, "tenant-1")
	body := `{"pipelineId":"p-1","runId":"r-1","status":"failed"}`
	c.Request = httptest.NewRequest("POST", "/pipelines/sse/publish/status", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")

	h.PublishStatus(c)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}
}

func TestGetStats_Success(t *testing.T) {
	hub := &mockHub{
		getStatsFn: func() *models.SSEStats {
			return &models.SSEStats{
				TotalConnections: 3,
				ConnectionsByUser: map[string]int{
					"user-1": 2,
					"user-2": 1,
				},
			}
		},
	}
	c, w, h := setupTest(t, hub)
	c.Request = httptest.NewRequest("GET", "/pipelines/sse/stats", nil)

	h.GetStats(c)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	data := extractSuccessData(t, w)
	var stats models.SSEStats
	if err := json.Unmarshal(data, &stats); err != nil {
		t.Fatalf("failed to parse stats: %v", err)
	}
	if stats.TotalConnections != 3 {
		t.Errorf("expected 3, got %d", stats.TotalConnections)
	}
	if stats.ConnectionsByUser["user-1"] != 2 {
		t.Errorf("expected 2 for user-1, got %d", stats.ConnectionsByUser["user-1"])
	}
}

func TestGetEvents_Success(t *testing.T) {
	hub := &mockHub{
		listEventsFn: func(_ context.Context, _, pipelineID, runID string, limit int) ([]map[string]interface{}, error) {
			return []map[string]interface{}{
				{"id": "event-1", "type": "log"},
				{"id": "event-2", "type": "status"},
			}, nil
		},
	}
	c, w, h := setupTest(t, hub)
	c.Request = httptest.NewRequest("GET", "/pipelines/sse/events?pipelineId=p-1&runId=r-1", nil)

	h.GetEvents(c)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	data := extractSuccessData(t, w)
	var events []map[string]interface{}
	if err := json.Unmarshal(data, &events); err != nil {
		t.Fatalf("failed to parse events: %v", err)
	}
	if len(events) != 2 {
		t.Errorf("expected 2 events, got %d", len(events))
	}
}

func TestGetEvents_MissingParams(t *testing.T) {
	tests := []struct {
		name string
		url  string
	}{
		{"missing pipelineId", "/pipelines/sse/events?runId=r-1"},
		{"missing runId", "/pipelines/sse/events?pipelineId=p-1"},
		{"both missing", "/pipelines/sse/events"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, w, h := setupTest(t, &mockHub{})
			c.Request = httptest.NewRequest("GET", tt.url, nil)

			h.GetEvents(c)

			if w.Code != http.StatusBadRequest {
				t.Errorf("expected 400, got %d", w.Code)
			}
		})
	}
}

func TestGetEvents_WithLimit(t *testing.T) {
	capturedLimit := 0
	hub := &mockHub{
		listEventsFn: func(_ context.Context, _, _, _ string, limit int) ([]map[string]interface{}, error) {
			capturedLimit = limit
			return []map[string]interface{}{}, nil
		},
	}
	c, w, h := setupTest(t, hub)
	c.Request = httptest.NewRequest("GET", "/pipelines/sse/events?pipelineId=p-1&runId=r-1&limit=50", nil)

	h.GetEvents(c)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
	if capturedLimit != 50 {
		t.Errorf("expected limit 50, got %d", capturedLimit)
	}
}

func TestGetEvents_InvalidLimit(t *testing.T) {
	capturedLimit := 0
	hub := &mockHub{
		listEventsFn: func(_ context.Context, _, _, _ string, limit int) ([]map[string]interface{}, error) {
			capturedLimit = limit
			return []map[string]interface{}{}, nil
		},
	}
	c, w, h := setupTest(t, hub)
	c.Request = httptest.NewRequest("GET", "/pipelines/sse/events?pipelineId=p-1&runId=r-1&limit=abc", nil)

	h.GetEvents(c)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200 for invalid limit (fallback to default), got %d", w.Code)
	}
	if capturedLimit != 200 {
		t.Errorf("expected default limit 200, got %d", capturedLimit)
	}
}

func TestGetEvents_HubError(t *testing.T) {
	hub := &mockHub{
		listEventsFn: func(_ context.Context, _, _, _ string, _ int) ([]map[string]interface{}, error) {
			return nil, assertError("repo error")
		},
	}
	c, w, h := setupTest(t, hub)
	c.Request = httptest.NewRequest("GET", "/pipelines/sse/events?pipelineId=p-1&runId=r-1", nil)

	h.GetEvents(c)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}
}

func TestGetTenantID_Fallback(t *testing.T) {
	c, _, h := setupTest(t, &mockHub{})
	c.Request = httptest.NewRequest("GET", "/", nil)

	tenantID := h.getTenantID(c)
	if tenantID != "" {
		t.Errorf("expected empty fallback (401), got %s", tenantID)
	}
}

func TestGetTenantID_FromContext(t *testing.T) {
	c, _, h := setupTest(t, &mockHub{})
	setTenant(c, "tenant-42")
	c.Request = httptest.NewRequest("GET", "/", nil)

	tenantID := h.getTenantID(c)
	if tenantID != "tenant-42" {
		t.Errorf("expected tenant-42, got %s", tenantID)
	}
}

// --- helpers ---

type assertError string

func (e assertError) Error() string { return string(e) }
