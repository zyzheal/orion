package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"testing"
	"time"

	"orion/platform-svc-go/internal/degradation/models"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

func TestTriggerRepository_CreateTrigger(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := NewTriggerRepository(sqlxDB)

	trigger := &models.DegradationTrigger{
		TenantID:    "tenant-1",
		PolicyID:    "policy-1",
		Status:      "active",
		Reason:      "error rate exceeded",
		ErrorRate:   0.15,
		LatencyMs:   1200,
		TriggeredAt: time.Now().UTC(),
	}

	mock.ExpectExec("INSERT INTO degradation_triggers").
		WithArgs(sqlmock.AnyArg(), "tenant-1", "policy-1", "active", "error rate exceeded", 0.15, int64(1200), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	ctx := context.Background()
	err = repo.CreateTrigger(ctx, trigger)
	if err != nil {
		t.Fatalf("CreateTrigger failed: %v", err)
	}
	if trigger.ID == "" {
		t.Error("expected ID to be set after CreateTrigger")
	}
	if trigger.CreatedAt.IsZero() {
		t.Error("expected CreatedAt to be set after CreateTrigger")
	}
}

func TestTriggerRepository_GetActiveTrigger(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := NewTriggerRepository(sqlxDB)

	now := time.Now().UTC()
	mock.ExpectQuery("SELECT \\* FROM degradation_triggers WHERE tenant_id").
		WithArgs("tenant-1", "policy-1").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "policy_id", "status", "reason", "error_rate",
			"latency_ms", "triggered_at", "created_at", "updated_at",
		}).AddRow("tr-1", "tenant-1", "policy-1", "active", "reason", 0.1, 500, now, now, now))

	ctx := context.Background()
	result, err := repo.GetActiveTrigger(ctx, "tenant-1", "policy-1")
	if err != nil {
		t.Fatalf("GetActiveTrigger failed: %v", err)
	}
	if result.ID != "tr-1" {
		t.Errorf("ID = %s, want tr-1", result.ID)
	}
	if result.Status != "active" {
		t.Errorf("Status = %s, want active", result.Status)
	}
}

func TestTriggerRepository_GetActiveTrigger_NotFound(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := NewTriggerRepository(sqlxDB)

	mock.ExpectQuery("SELECT \\* FROM degradation_triggers WHERE tenant_id").
		WithArgs("tenant-1", "policy-1").
		WillReturnError(sql.ErrNoRows)

	ctx := context.Background()
	_, err = repo.GetActiveTrigger(ctx, "tenant-1", "policy-1")
	if !errors.Is(err, ErrNoTriggers) {
		t.Errorf("expected ErrNoTriggers, got: %v", err)
	}
}

func TestTriggerRepository_ListTriggersByPolicy(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := NewTriggerRepository(sqlxDB)

	now := time.Now().UTC()
	mock.ExpectQuery("SELECT \\* FROM degradation_triggers WHERE tenant_id").
		WithArgs("tenant-1", "policy-1", 20, 0).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "policy_id", "status", "reason", "error_rate",
			"latency_ms", "triggered_at", "created_at", "updated_at",
		}).AddRow("tr-1", "tenant-1", "policy-1", "active", "r1", 0.1, 500, now, now, now))

	ctx := context.Background()
	triggers, err := repo.ListTriggersByPolicy(ctx, "tenant-1", "policy-1", 20, 0)
	if err != nil {
		t.Fatalf("ListTriggersByPolicy failed: %v", err)
	}
	if len(triggers) != 1 {
		t.Errorf("count = %d, want 1", len(triggers))
	}
}

func TestTriggerRepository_CountTriggersByPolicy(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := NewTriggerRepository(sqlxDB)

	mock.ExpectQuery("SELECT COUNT").WithArgs("tenant-1", "policy-1").WillReturnRows(
		sqlmock.NewRows([]string{"count"}).AddRow(5))

	ctx := context.Background()
	count, err := repo.CountTriggersByPolicy(ctx, "tenant-1", "policy-1")
	if err != nil {
		t.Fatalf("CountTriggersByPolicy failed: %v", err)
	}
	if count != 5 {
		t.Errorf("count = %d, want 5", count)
	}
}

func TestTriggerRepository_CreateAction(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := NewTriggerRepository(sqlxDB)

	action := &models.DegradationAction{
		TriggerID: "tr-1",
		TenantID:  "tenant-1",
		Action:    "circuit_break",
		Detail:    "circuit broken",
		Status:    "applied",
	}

	mock.ExpectExec("INSERT INTO degradation_actions").
		WithArgs(sqlmock.AnyArg(), "tr-1", "tenant-1", "circuit_break", "circuit broken", "applied", sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	ctx := context.Background()
	err = repo.CreateAction(ctx, action)
	if err != nil {
		t.Fatalf("CreateAction failed: %v", err)
	}
	if action.ID == "" {
		t.Error("expected ID to be set after CreateAction")
	}
}

func TestTriggerRepository_ListActionsByTrigger(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := NewTriggerRepository(sqlxDB)

	now := time.Now().UTC()
	mock.ExpectQuery("SELECT \\* FROM degradation_actions WHERE trigger_id").
		WithArgs("tr-1", "tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "trigger_id", "tenant_id", "action", "detail", "status", "created_at",
		}).AddRow("a-1", "tr-1", "tenant-1", "circuit_break", "detail", "applied", now))

	ctx := context.Background()
	actions, err := repo.ListActionsByTrigger(ctx, "tenant-1", "tr-1")
	if err != nil {
		t.Fatalf("ListActionsByTrigger failed: %v", err)
	}
	if len(actions) != 1 {
		t.Errorf("count = %d, want 1", len(actions))
	}
}

func TestTriggerRepository_GetLatestTriggerTime(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := NewTriggerRepository(sqlxDB)

	now := time.Now().UTC()
	mock.ExpectQuery("SELECT MAX").WithArgs("tenant-1", "policy-1").WillReturnRows(
		sqlmock.NewRows([]string{"max"}).AddRow(now))

	ctx := context.Background()
	tt, err := repo.GetLatestTriggerTime(ctx, "tenant-1", "policy-1")
	if err != nil {
		t.Fatalf("GetLatestTriggerTime failed: %v", err)
	}
	if tt == nil {
		t.Fatal("expected non-nil time")
	}
}

func TestTriggerRepository_GetLatestTriggerTime_NeverTriggered(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := NewTriggerRepository(sqlxDB)

	mock.ExpectQuery("SELECT MAX").WithArgs("tenant-1", "policy-1").WillReturnError(sql.ErrNoRows)

	ctx := context.Background()
	tt, err := repo.GetLatestTriggerTime(ctx, "tenant-1", "policy-1")
	if err != nil {
		t.Fatalf("GetLatestTriggerTime failed: %v", err)
	}
	if tt != nil {
		t.Errorf("expected nil time for never-triggered, got: %v", tt)
	}
}

func TestTriggerRepository_RevertAction(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := NewTriggerRepository(sqlxDB)

	mock.ExpectExec("UPDATE degradation_actions SET status").
		WithArgs(sqlmock.AnyArg(), "a-1", "tenant-1").
		WillReturnResult(sqlmock.NewResult(1, 1))

	ctx := context.Background()
	err = repo.RevertAction(ctx, "tenant-1", "a-1")
	if err != nil {
		t.Fatalf("RevertAction failed: %v", err)
	}
}

// Helper
func init() {
	_ = fmt.Sprintf // suppress unused import guard
}
