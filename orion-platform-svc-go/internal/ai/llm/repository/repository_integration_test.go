//go:build integration
// +build integration

package repository

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"

	"orion/platform-svc-go/internal/ai/llm/models"
)

func connectDB(t *testing.T) *sqlx.DB {
	t.Helper()
	dsn := os.Getenv("DB_DSN")
	if dsn == "" {
		dsn = "postgres://test:test@localhost:5432/orion_test?sslmode=disable"
	}
	db, err := sqlx.Connect("postgres", dsn)
	if err != nil {
		t.Fatalf("failed to connect to DB: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}

func TestLLMRepository_CreateTrace_Integration(t *testing.T) {
	db := connectDB(t)
	repo := NewRepository(db)

	now := time.Now().UTC()
	trace := &models.LLMTrace{
		TraceID:          "test-integration-trace-1",
		TenantID:         "tenant-integration-1",
		ModelID:          "gpt-4",
		InputTokens:      100,
		OutputTokens:     50,
		TotalTokens:      150,
		InputCost:        0.002,
		OutputCost:       0.004,
		TotalCost:        0.006,
		Currency:         "CNY",
		Status:           "pending",
		RequestStartedAt: now,
		CreatedAt:        now,
	}

	saved, err := repo.CreateTrace(context.Background(), trace)
	if err != nil {
		t.Fatalf("CreateTrace failed: %v", err)
	}
	if saved.TraceID != trace.TraceID {
		t.Errorf("expected trace_id %s, got %s", trace.TraceID, saved.TraceID)
	}

	// Cleanup
	_, _ = db.ExecContext(context.Background(), `DELETE FROM llm_traces WHERE trace_id = $1`, trace.TraceID)
}

func TestLLMRepository_FindTraceByTraceID_Integration(t *testing.T) {
	db := connectDB(t)
	repo := NewRepository(db)

	now := time.Now().UTC()
	// Insert test data
	_, err := db.ExecContext(context.Background(), `
		INSERT INTO llm_traces (trace_id, tenant_id, model_id, status, request_started_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)`,
		"test-find-trace-1", "tenant-1", "gpt-4", "completed", now, now)
	if err != nil {
		t.Fatalf("setup failed: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.ExecContext(context.Background(), `DELETE FROM llm_traces WHERE trace_id = $1`, "test-find-trace-1")
	})

	found, err := repo.FindTraceByTraceID(context.Background(), "test-find-trace-1")
	if err != nil {
		t.Fatalf("FindTraceByTraceID failed: %v", err)
	}
	if found.TenantID != "tenant-1" {
		t.Errorf("expected tenant-1, got %s", found.TenantID)
	}
	if found.Status != "completed" {
		t.Errorf("expected completed, got %s", found.Status)
	}
}
