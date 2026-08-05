package service

import (
	"context"
	"testing"
	"time"

	"orion/platform-svc-go/internal/logging/models"
)

// mockRepo implements RepositoryInterface for testing service logic without DB.
type mockRepo struct {
	entries  []*models.LogEntry
	errOn    string // triggers error for: insert|batch|query|aggregation|delete|getbyid|findbytrace
}

func (m *mockRepo) Insert(_ context.Context, e *models.LogEntry) error {
	if m.errOn == "insert" {
		return errFail
	}
	m.entries = append(m.entries, e)
	return nil
}

func (m *mockRepo) InsertBatch(_ context.Context, es []*models.LogEntry) error {
	if m.errOn == "batch" {
		return errFail
	}
	m.entries = append(m.entries, es...)
	return nil
}

func (m *mockRepo) GetByID(_ context.Context, _, _ string) (*models.LogEntry, error) {
	if m.errOn == "getbyid" {
		return nil, errFail
	}
	return &models.LogEntry{ID: "x", TenantID: "t", Message: "ok"}, nil
}

func (m *mockRepo) FindByTraceID(_ context.Context, _, _ string) ([]models.LogEntry, error) {
	if m.errOn == "findbytrace" {
		return nil, errFail
	}
	return []models.LogEntry{{ID: "x", TenantID: "t", Message: "ok"}}, nil
}

func (m *mockRepo) Query(_ context.Context, _ *models.LogQuery) ([]models.LogEntry, int64, error) {
	if m.errOn == "query" {
		return nil, 0, errFail
	}
	return []models.LogEntry{{ID: "x", TenantID: "t", Message: "ok"}}, 1, nil
}

func (m *mockRepo) Aggregation(_ context.Context, _ *models.LogQuery) (*models.LogAggregation, error) {
	if m.errOn == "aggregation" {
		return nil, errFail
	}
	return &models.LogAggregation{Total: 1, ByLevel: map[string]int64{"INFO": 1}, ByService: map[string]int64{"svc": 1}}, nil
}

func (m *mockRepo) DeleteByTime(_ context.Context, _ string, _ time.Time) (int64, error) {
	if m.errOn == "delete" {
		return 0, errFail
	}
	return 5, nil
}

var errFail = &internalError{msg: "forced fail"}

type internalError struct{ msg string }
func (e *internalError) Error() string { return e.msg }

func mockReq() models.IngestLogRequest {
	return models.IngestLogRequest{
		Service: "api-svc", Level: "ERROR", Message: "timeout",
		TraceID: "trace-123",
		Metadata: map[string]interface{}{"key": "val"},
	}
}

// --- Ingest ---

func TestService_Ingest(t *testing.T) {
	repo := &mockRepo{}
	svc := NewService(repo)
	entry, err := svc.Ingest(context.Background(), "tenant-1", mockReq())
	if err != nil {
		t.Fatalf("Ingest failed: %v", err)
	}
	if entry == nil {
		t.Fatal("expected non-nil entry")
	}
	if entry.TenantID != "tenant-1" {
		t.Errorf("TenantID = %s, want tenant-1", entry.TenantID)
	}
	if entry.TraceID != "trace-123" {
		t.Errorf("TraceID = %s, want trace-123", entry.TraceID)
	}
	if entry.Level != "ERROR" {
		t.Errorf("Level = %s, want ERROR", entry.Level)
	}
	if entry.Metadata == nil || len(entry.Metadata) == 0 {
		t.Error("expected metadata")
	}
	if len(repo.entries) != 1 {
		t.Errorf("expected 1 repo insert, got %d", len(repo.entries))
	}
}

func TestService_Ingest_WithTimestamp(t *testing.T) {
	repo := &mockRepo{}
	svc := NewService(repo)
	ts := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	req := mockReq()
	req.Timestamp = &ts
	entry, err := svc.Ingest(context.Background(), "tenant-1", req)
	if err != nil {
		t.Fatalf("Ingest failed: %v", err)
	}
	if !entry.Timestamp.Equal(ts) {
		t.Errorf("Timestamp = %v, want %v", entry.Timestamp, ts)
	}
}

func TestService_Ingest_Error(t *testing.T) {
	repo := &mockRepo{errOn: "insert"}
	svc := NewService(repo)
	_, err := svc.Ingest(context.Background(), "tenant-1", mockReq())
	if err == nil {
		t.Fatal("expected Ingest error")
	}
}

// --- IngestBatch ---

func TestService_IngestBatch(t *testing.T) {
	repo := &mockRepo{}
	svc := NewService(repo)
	reqs := []models.IngestLogRequest{mockReq(), mockReq()}
	n, err := svc.IngestBatch(context.Background(), "t", reqs)
	if err != nil {
		t.Fatalf("IngestBatch failed: %v", err)
	}
	if n != 2 {
		t.Errorf("returned %d, want 2", n)
	}
	if len(repo.entries) != 2 {
		t.Errorf("repo has %d entries, want 2", len(repo.entries))
	}
}

func TestService_IngestBatch_Empty(t *testing.T) {
	repo := &mockRepo{}
	svc := NewService(repo)
	n, err := svc.IngestBatch(context.Background(), "t", nil)
	if err != nil {
		t.Fatalf("IngestBatch(nil) failed: %v", err)
	}
	if n != 0 {
		t.Errorf("returned %d, want 0", n)
	}
}

func TestService_IngestBatch_Error(t *testing.T) {
	repo := &mockRepo{errOn: "batch"}
	svc := NewService(repo)
	_, err := svc.IngestBatch(context.Background(), "t", []models.IngestLogRequest{mockReq()})
	if err == nil {
		t.Fatal("expected IngestBatch error")
	}
}

// --- GetByTrace ---

func TestService_GetByTrace(t *testing.T) {
	repo := &mockRepo{}
	svc := NewService(repo)
	entries, err := svc.GetByTrace(context.Background(), "t", "trace-1")
	if err != nil {
		t.Fatalf("GetByTrace failed: %v", err)
	}
	if len(entries) != 1 {
		t.Errorf("got %d entries, want 1", len(entries))
	}
}

func TestService_GetByTrace_Error(t *testing.T) {
	repo := &mockRepo{errOn: "findbytrace"}
	svc := NewService(repo)
	_, err := svc.GetByTrace(context.Background(), "t", "trace-1")
	if err == nil {
		t.Fatal("expected GetByTrace error")
	}
}

// --- Query ---

func TestService_Query_OK(t *testing.T) {
	repo := &mockRepo{}
	svc := NewService(repo)
	entries, total, err := svc.Query(context.Background(), &models.LogQuery{TenantID: "t"})
	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}
	if total != 1 {
		t.Errorf("total = %d, want 1", total)
	}
	if len(entries) != 1 {
		t.Errorf("got %d entries, want 1", len(entries))
	}
}

func TestService_Query_RequiresTenantID(t *testing.T) {
	repo := &mockRepo{}
	svc := NewService(repo)
	_, _, err := svc.Query(context.Background(), &models.LogQuery{TenantID: ""})
	if err == nil {
		t.Fatal("expected error for empty tenantId")
	}
}

func TestService_Query_Error(t *testing.T) {
	repo := &mockRepo{errOn: "query"}
	svc := NewService(repo)
	_, _, err := svc.Query(context.Background(), &models.LogQuery{TenantID: "t"})
	if err == nil {
		t.Fatal("expected Query error")
	}
}

// --- Aggregation ---

func TestService_Aggregation_OK(t *testing.T) {
	repo := &mockRepo{}
	svc := NewService(repo)
	agg, err := svc.Aggregation(context.Background(), &models.LogQuery{TenantID: "t"})
	if err != nil {
		t.Fatalf("Aggregation failed: %v", err)
	}
	if agg.Total != 1 {
		t.Errorf("Total = %d, want 1", agg.Total)
	}
	if len(agg.ByLevel) != 1 {
		t.Errorf("ByLevel has %d entries, want 1", len(agg.ByLevel))
	}
}

func TestService_Aggregation_RequiresTenantID(t *testing.T) {
	repo := &mockRepo{}
	svc := NewService(repo)
	_, err := svc.Aggregation(context.Background(), &models.LogQuery{TenantID: ""})
	if err == nil {
		t.Fatal("expected error for empty tenantId")
	}
}

func TestService_Aggregation_Error(t *testing.T) {
	repo := &mockRepo{errOn: "aggregation"}
	svc := NewService(repo)
	_, err := svc.Aggregation(context.Background(), &models.LogQuery{TenantID: "t"})
	if err == nil {
		t.Fatal("expected Aggregation error")
	}
}

// --- Search ---

func TestService_Search_OK(t *testing.T) {
	repo := &mockRepo{}
	svc := NewService(repo)
	entries, err := svc.Search(context.Background(), "t", []string{"error"})
	if err != nil {
		t.Fatalf("Search failed: %v", err)
	}
	if len(entries) != 1 {
		t.Errorf("got %d entries, want 1", len(entries))
	}
}

func TestService_Search_Error(t *testing.T) {
	repo := &mockRepo{errOn: "query"}
	svc := NewService(repo)
	_, err := svc.Search(context.Background(), "t", []string{"error"})
	if err == nil {
		t.Fatal("expected Search error")
	}
}

// --- CleanupOld ---

func TestService_CleanupOld(t *testing.T) {
	repo := &mockRepo{}
	svc := NewService(repo)
	n, err := svc.CleanupOld(context.Background(), "t")
	if err != nil {
		t.Fatalf("CleanupOld failed: %v", err)
	}
	if n != 5 {
		t.Errorf("deleted = %d, want 5", n)
	}
}

func TestService_CleanupOld_Error(t *testing.T) {
	repo := &mockRepo{errOn: "delete"}
	svc := NewService(repo)
	_, err := svc.CleanupOld(context.Background(), "t")
	if err == nil {
		t.Fatal("expected CleanupOld error")
	}
}

// --- Constants ---

func TestService_RetentionDays(t *testing.T) {
	if RetentionDays != 30 {
		t.Errorf("RetentionDays = %d, want 30", RetentionDays)
	}
}
