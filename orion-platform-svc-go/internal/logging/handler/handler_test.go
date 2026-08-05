package handler

import (
	"context"
	"encoding/json"
	"io"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/logging/models"
	"orion/platform-svc-go/internal/logging/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type testRepo struct {
	entries []*models.LogEntry
	agg     *models.LogAggregation
	delN    int64
}

func (m *testRepo) Insert(ctx context.Context, e *models.LogEntry) error {
	e.ID = uuid.New().String(); e.CreatedAt = time.Now()
	if e.Timestamp.IsZero() { e.Timestamp = time.Now() }
	m.entries = append(m.entries, e); return nil
}
func (m *testRepo) InsertBatch(ctx context.Context, es []*models.LogEntry) error {
	for _, e := range es { e.ID = uuid.New().String(); e.CreatedAt = time.Now(); if e.Timestamp.IsZero() { e.Timestamp = time.Now() } }
	m.entries = append(m.entries, es...); return nil
}
func (m *testRepo) GetByID(ctx context.Context, tid, id string) (*models.LogEntry, error) { return &models.LogEntry{ID: "x"}, nil }
func (m *testRepo) FindByTraceID(ctx context.Context, tid, traceID string) ([]models.LogEntry, error) {
	var found []models.LogEntry
	for _, e := range m.entries { if e.TraceID == traceID { found = append(found, *e) } }
	return found, nil
}
func (m *testRepo) Query(ctx context.Context, q *models.LogQuery) ([]models.LogEntry, int64, error) {
	return []models.LogEntry{{ID: "1", TenantID: q.TenantID, Message: "hit"}}, 1, nil
}
func (m *testRepo) Aggregation(ctx context.Context, q *models.LogQuery) (*models.LogAggregation, error) {
	if m.agg != nil { return m.agg, nil }
	return &models.LogAggregation{Total: 10, ByLevel: map[string]int64{"INFO": 8, "ERROR": 2}, ByService: map[string]int64{"api": 5},
		TimeRange: struct{ From time.Time `json:"from"`; To time.Time `json:"to"` }{From: time.Now().Add(-24 * time.Hour), To: time.Now()}}, nil
}
func (m *testRepo) DeleteByTime(ctx context.Context, tid string, before time.Time) (int64, error) { m.delN = 7; return 7, nil }

func testCtx(w *httptest.ResponseRecorder, method, path, body string) *gin.Context {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1"); c.Set("role", "super_admin")
	var reader io.Reader
	if body != "" { reader = io.NopCloser(strings.NewReader(body)) } else { reader = strings.NewReader("") }
	c.Request = httptest.NewRequest(method, path, reader)
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{}
	return c
}

func TestHandler_Ingest_OK(t *testing.T) {
	repo := &testRepo{}; svc := service.NewService(repo); h := NewHandler(svc)
	w := httptest.NewRecorder()
	c := testCtx(w, "POST", "/logs", `{"service":"api-svc","level":"ERROR","message":"timeout","traceId":"t123","metadata":{"k":"v"}}`)
	h.Ingest(c)
	if w.Code != 201 { t.Fatalf("status=%d want 201: %s", w.Code, w.Body.String()) }
	if len(repo.entries) != 1 { t.Fatalf("got %d entries want 1", len(repo.entries)) }
	e := repo.entries[0]
	if e.TenantID != "tenant-1" { t.Errorf("TenantID=%s want tenant-1", e.TenantID) }
	if e.TraceID != "t123" { t.Errorf("TraceID=%s want t123", e.TraceID) }
	if _, err := uuid.Parse(e.ID); err != nil { t.Errorf("ID not UUID: %s", e.ID) }
}

func TestHandler_Ingest_BadBody(t *testing.T) {
	repo := &testRepo{}; svc := service.NewService(repo); h := NewHandler(svc)
	w := httptest.NewRecorder()
	c := testCtx(w, "POST", "/logs", `{"foo":"bar"}`)
	h.Ingest(c)
	if w.Code != 400 { t.Fatalf("status=%d want 400: %s", w.Code, w.Body.String()) }
}

func TestHandler_Ingest_UUID_Generated(t *testing.T) {
	repo := &testRepo{}; svc := service.NewService(repo); h := NewHandler(svc)
	w := httptest.NewRecorder()
	c := testCtx(w, "POST", "/logs", `{"service":"a","level":"INFO","message":"x"}`)
	h.Ingest(c)
	if len(repo.entries) == 0 { t.Fatal("expected 1 entry") }
	if _, err := uuid.Parse(repo.entries[0].ID); err != nil { t.Fatalf("ID not UUID: %s (%v)", repo.entries[0].ID, err) }
}

func TestHandler_Ingest_CustomTimestamp(t *testing.T) {
	repo := &testRepo{}; svc := service.NewService(repo); h := NewHandler(svc)
	w := httptest.NewRecorder()
	c := testCtx(w, "POST", "/logs", `{"service":"a","level":"DEBUG","message":"m","timestamp":"2026-06-15T10:00:00Z"}`)
	h.Ingest(c)
	ts := time.Date(2026, 6, 15, 10, 0, 0, 0, time.UTC)
	if !repo.entries[0].Timestamp.Equal(ts) { t.Errorf("Timestamp=%v want %v", repo.entries[0].Timestamp, ts) }
}

func TestHandler_IngestBatch_OK(t *testing.T) {
	repo := &testRepo{}; svc := service.NewService(repo); h := NewHandler(svc)
	w := httptest.NewRecorder()
	c := testCtx(w, "POST", "/logs/batch", `[{"service":"a","level":"INFO","message":"m1"},{"service":"b","level":"WARN","message":"m2"}]`)
	h.IngestBatch(c)
	if w.Code != 201 { t.Fatalf("status=%d want 201: %s", w.Code, w.Body.String()) }
	if len(repo.entries) != 2 { t.Fatalf("got %d entries want 2", len(repo.entries)) }
	var body map[string]interface{}; json.NewDecoder(w.Body).Decode(&body)
	data := body["data"].(map[string]interface{})
	if data["ingested"].(float64) != 2 { t.Errorf("ingested=%v want 2", data["ingested"]) }
}

func TestHandler_GetByTrace_OK(t *testing.T) {
	repo := &testRepo{}; svc := service.NewService(repo); h := NewHandler(svc)
	svc.Ingest(context.Background(), "tenant-1", models.IngestLogRequest{Service: "a", Level: "INFO", Message: "trace-log", TraceID: "t-abc"})
	w := httptest.NewRecorder()
	c := testCtx(w, "GET", "/logs/trace/t-abc", "")
	c.Params = gin.Params{{Key: "traceId", Value: "t-abc"}}
	h.GetByTrace(c)
	if w.Code != 200 { t.Fatalf("status=%d want 200: %s", w.Code, w.Body.String()) }
	var body map[string]interface{}; json.NewDecoder(w.Body).Decode(&body)
	inner := body["data"].(map[string]interface{})
	data := inner["data"].([]interface{})
	if len(data) < 1 { t.Error("expected at least 1 trace entry") }
}

func TestHandler_GetByTrace_Empty(t *testing.T) {
	repo := &testRepo{}; svc := service.NewService(repo); h := NewHandler(svc)
	w := httptest.NewRecorder()
	c := testCtx(w, "GET", "/logs/trace/nonexistent", "")
	c.Params = gin.Params{{Key: "traceId", Value: "nonexistent"}}
	h.GetByTrace(c)
	if w.Code != 200 { t.Fatalf("status=%d want 200: %s", w.Code, w.Body.String()) }
}

func TestHandler_Search_OK(t *testing.T) {
	repo := &testRepo{}; svc := service.NewService(repo); h := NewHandler(svc)
	w := httptest.NewRecorder()
	c := testCtx(w, "GET", "/logs/search?keyword=error&keyword=timeout", "")
	h.Search(c)
	if w.Code != 200 { t.Fatalf("status=%d want 200: %s", w.Code, w.Body.String()) }
	var body map[string]interface{}; json.NewDecoder(w.Body).Decode(&body)
	inner := body["data"].(map[string]interface{})
	data := inner["data"].([]interface{})
	if len(data) != 1 { t.Errorf("got %d results want 1", len(data)) }
}

func TestHandler_Aggregation_OK(t *testing.T) {
	repo := &testRepo{}; svc := service.NewService(repo); h := NewHandler(svc)
	w := httptest.NewRecorder()
	c := testCtx(w, "GET", "/logs/aggregate?service=api&level=ERROR", "")
	h.Aggregation(c)
	if w.Code != 200 { t.Fatalf("status=%d want 200: %s", w.Code, w.Body.String()) }
	var body map[string]interface{}; json.NewDecoder(w.Body).Decode(&body)
	agg := body["data"].(map[string]interface{})
	if agg["total"].(float64) != 10 { t.Errorf("total=%v want 10", agg["total"]) }
}

func TestHandler_CleanupOld_OK(t *testing.T) {
	repo := &testRepo{}; svc := service.NewService(repo); h := NewHandler(svc)
	w := httptest.NewRecorder()
	c := testCtx(w, "DELETE", "/logs/cleanup", "")
	h.CleanupOld(c)
	if w.Code != 200 { t.Fatalf("status=%d want 200: %s", w.Code, w.Body.String()) }
	if repo.delN != 7 { t.Errorf("deleted=%d want 7", repo.delN) }
}

func TestHandler_getTenantID_Missing(t *testing.T) {
	gin.SetMode(gin.TestMode); w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	h := NewHandler(service.NewService(&testRepo{}))
	result := h.getTenantID(c)
	if result != "" { t.Errorf("expected empty got %q", result) }
}

func TestHandler_getTenantID_Present(t *testing.T) {
	gin.SetMode(gin.TestMode); w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "t-test")
	h := NewHandler(service.NewService(&testRepo{}))
	result := h.getTenantID(c)
	if result != "t-test" { t.Errorf("tenantID=%s want t-test", result) }
}

func TestHandler_RegisterRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode); r := gin.New()
	h := NewHandler(service.NewService(&testRepo{}))
	h.RegisterRoutes(r.Group("/logs"))
	if len(r.Routes()) < 5 { t.Fatalf("expected >=5 routes, got %d", len(r.Routes())) }
}

var _ service.RepositoryInterface = (*testRepo)(nil)
