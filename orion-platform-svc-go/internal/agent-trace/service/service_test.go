package service

import (
	"context"
	"testing"

	"orion/platform-svc-go/internal/agent-trace/models"
)

func Test_NewService_NilRepo(t *testing.T) {
	svc := NewService(nil)
	if svc == nil {
		t.Fatal("nil service")
	}
}

func Test_Service_RecordTrace_NilRepo(t *testing.T) {
	svc := NewService(nil)
	err := svc.RecordTrace(context.Background(), &models.AgentTrace{AgentID: "a1"})
	if err == nil {
		t.Fatal("expected error with nil repo")
	}
}

func Test_Service_RecordTrace_Success(t *testing.T) {
	store := NewInMemoryRepository()
	svc := NewService(store)

	trace := &models.AgentTrace{
		TenantID:   "t1",
		UserID:     "u1",
		AgentID:    "agent-1",
		AgentName:  "test-agent",
		Status:     "completed",
		DurationMs: 150,
	}
	err := svc.RecordTrace(context.Background(), trace)
	if err != nil {
		t.Fatalf("RecordTrace: %v", err)
	}
	if trace.ID == "" {
		t.Fatal("expected generated trace ID")
	}
}

func Test_Service_GetTrace(t *testing.T) {
	store := NewInMemoryRepository()
	svc := NewService(store)

	// Store a trace directly
	tr := &models.AgentTrace{ID: "tr-1", TenantID: "t1", AgentID: "a1", Status: "completed"}
	store.SaveTrace(context.Background(), tr)

	got, err := svc.GetTrace(context.Background(), "t1", "tr-1")
	if err != nil {
		t.Fatalf("GetTrace: %v", err)
	}
	if got.AgentID != "a1" {
		t.Fatalf("unexpected agent_id: %s", got.AgentID)
	}
}

func Test_Service_GetTrace_NotFound(t *testing.T) {
	svc := NewService(NewInMemoryRepository())
	_, err := svc.GetTrace(context.Background(), "t1", "missing")
	if err == nil {
		t.Fatal("expected error for missing trace")
	}
}

func Test_Service_CompleteTrace(t *testing.T) {
	store := NewInMemoryRepository()
	svc := NewService(store)

	tr := &models.AgentTrace{ID: "tr-1", TenantID: "t1", Status: "running"}
	store.SaveTrace(context.Background(), tr)

	err := svc.CompleteTrace(context.Background(), "t1", "tr-1", "", 200, "answer")
	if err != nil {
		t.Fatalf("CompleteTrace: %v", err)
	}

	got, _ := store.GetByTraceID(context.Background(), "t1", "tr-1")
	if got.Status != "completed" {
		t.Fatalf("expected completed, got %s", got.Status)
	}
	if got.DurationMs != 200 {
		t.Fatalf("expected 200ms, got %d", got.DurationMs)
	}
}

func Test_Service_CompleteTrace_Failed(t *testing.T) {
	store := NewInMemoryRepository()
	svc := NewService(store)

	tr := &models.AgentTrace{ID: "tr-1", TenantID: "t1", Status: "running"}
	store.SaveTrace(context.Background(), tr)

	err := svc.CompleteTrace(context.Background(), "t1", "tr-1", "timeout", 5000, "")
	if err != nil {
		t.Fatalf("CompleteTrace: %v", err)
	}

	got, _ := store.GetByTraceID(context.Background(), "t1", "tr-1")
	if got.Status != "failed" {
		t.Fatalf("expected failed, got %s", got.Status)
	}
	if got.Error != "timeout" {
		t.Fatalf("expected error=timeout, got %s", got.Error)
	}
}

func Test_Service_ListTraces(t *testing.T) {
	store := NewInMemoryRepository()
	svc := NewService(store)

	for i := 0; i < 5; i++ {
		store.SaveTrace(context.Background(), &models.AgentTrace{
			ID:       "tr-" + string(rune('1'+i)),
			TenantID: "t1",
			AgentID:  "a1",
			Status:   "completed",
		})
	}

	traces, total, err := svc.ListTraces(context.Background(), models.TraceQueryRequest{
		Limit: 10,
	})
	if err != nil {
		t.Fatalf("ListTraces: %v", err)
	}
	if total != 5 {
		t.Fatalf("expected 5 total, got %d", total)
	}
	if len(traces) != 5 {
		t.Fatalf("expected 5 traces, got %d", len(traces))
	}
}

func Test_Service_GetMetrics_Empty(t *testing.T) {
	store := NewInMemoryRepository()
	svc := NewService(store)

	metric, err := svc.GetMetrics(context.Background(), "t1", "a1", 7)
	if err != nil {
		t.Fatalf("GetMetrics: %v", err)
	}
	if metric.TotalRuns != 0 {
		t.Fatalf("expected 0 runs, got %d", metric.TotalRuns)
	}
	if metric.SuccessRate != 0 {
		t.Fatalf("expected 0 rate, got %f", metric.SuccessRate)
	}
}

func Test_Service_GetMetrics_WithTraces(t *testing.T) {
	store := NewInMemoryRepository()
	svc := NewService(store)

	traces := []*models.AgentTrace{
		{ID: "tr-1", TenantID: "t1", AgentID: "a1", Status: "completed", DurationMs: 100, TokenUsage: models.TokenUsage{InputTokens: 50, OutputTokens: 20, TotalTokens: 70, EstimatedCost: 0.001}},
		{ID: "tr-2", TenantID: "t1", AgentID: "a1", Status: "completed", DurationMs: 200, TokenUsage: models.TokenUsage{InputTokens: 100, OutputTokens: 40, TotalTokens: 140, EstimatedCost: 0.002}},
		{ID: "tr-3", TenantID: "t1", AgentID: "a1", Status: "failed", DurationMs: 300, TokenUsage: models.TokenUsage{InputTokens: 50, OutputTokens: 10, TotalTokens: 60, EstimatedCost: 0.0005}},
	}
	for _, tr := range traces {
		store.SaveTrace(context.Background(), tr)
	}

	metric, err := svc.GetMetrics(context.Background(), "t1", "a1", 7)
	if err != nil {
		t.Fatalf("GetMetrics: %v", err)
	}
	if metric.TotalRuns != 3 {
		t.Fatalf("expected 3 runs, got %d", metric.TotalRuns)
	}
	if metric.SuccessCount != 2 {
		t.Fatalf("expected 2 success, got %d", metric.SuccessCount)
	}
	if metric.FailureCount != 1 {
		t.Fatalf("expected 1 failure, got %d", metric.FailureCount)
	}
	if metric.TotalInputTokens != 200 {
		t.Fatalf("expected 200 input tokens, got %d", metric.TotalInputTokens)
	}
}

func Test_Service_GetMetrics_DefaultDays(t *testing.T) {
	store := NewInMemoryRepository()
	svc := NewService(store)

	metric, err := svc.GetMetrics(context.Background(), "t1", "a1", 0)
	if err != nil {
		t.Fatalf("GetMetrics: %v", err)
	}
	if metric.WindowStart.IsZero() {
		t.Fatal("expected non-zero window_start")
	}
}

func Test_InMemoryRepository_Distinct(t *testing.T) {
	r1 := NewInMemoryRepository()
	r2 := NewInMemoryRepository()
	if r1 == r2 {
		t.Fatal("expected distinct instances")
	}
}

func Test_InMemoryRepository_UpdateTraceStatus_NotFound(t *testing.T) {
	store := NewInMemoryRepository()
	err := store.UpdateTraceStatus(context.Background(), "t1", "missing", "completed", "err", 100, "resp")
	if err == nil {
		t.Fatal("expected error")
	}
}

func Test_Repository_SaveTrace_EmptyID(t *testing.T) {
	store := NewInMemoryRepository()
	tr := &models.AgentTrace{TenantID: "t1", AgentID: "a1"}
	store.SaveTrace(context.Background(), tr)
	if tr.ID == "" {
		t.Fatal("expected generated ID")
	}
}
