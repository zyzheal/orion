package repository

import (
	"context"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
	"orion/platform-svc-go/internal/pipeline-audit-log/models"
)

const testTenant = "tenant-123"
const testRunID = "run-456"

func setupRepo(t *testing.T) (*Repository, sqlmock.Sqlmock, *sqlx.DB) {
	t.Helper()
	sqlxDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	db := sqlx.NewDb(sqlxDB, "sqlmock")
	repo := NewRepository(db)
	return repo, mock, db
}

func TestRepository_GetAuditLogByPipeline_OK(t *testing.T) {
	repo, mock, db := setupRepo(t)
	defer db.Close()

	createdAt := time.Now().UTC()
	rows := sqlmock.NewRows([]string{
		"id", "tenant_id", "run_id", "stage_id", "task_id",
		"action", "actor", "outcome", "duration_ms",
		"input_summary", "output_summary", "error_message", "metadata",
		"resource_type", "resource_id", "details", "ip_address",
		"created_at",
	}).AddRow(
		"log-id-1", testTenant, testRunID, "stage-1", nil,
		"deploy", "user-a", "success", int64(1000),
		nil, "output ok", nil, "{}",
		"pipeline", "pipeline-abc", "deployed to prod", "10.0.0.1",
		createdAt,
	)

	mock.ExpectQuery("SELECT COUNT\\(\\*\\)").
		WithArgs(testTenant, testRunID).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
	mock.ExpectQuery("SELECT \\* FROM pipeline_audit_logs").
		WithArgs(testTenant, testRunID, 10, 0).
		WillReturnRows(rows)

	logs, total, err := repo.GetAuditLogByPipeline(context.Background(), testTenant, testRunID, 10, 0)
	if err != nil {
		t.Fatalf("GetAuditLogByPipeline: %v", err)
	}
	if total != 1 {
		t.Fatalf("total = %d, want 1", total)
	}
	if len(logs) != 1 {
		t.Fatalf("logs len = %d, want 1", len(logs))
	}
	if logs[0].ResourceType == nil || *logs[0].ResourceType != "pipeline" {
		t.Fatalf("ResourceType = %v, want pipeline", logs[0].ResourceType)
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unfulfilled expectations: %v", err)
	}
}

func TestRepository_GetAuditLogByPipeline_Empty(t *testing.T) {
	repo, mock, db := setupRepo(t)
	defer db.Close()

	mock.ExpectQuery("SELECT COUNT\\(\\*\\)").
		WithArgs(testTenant, testRunID).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectQuery("SELECT \\* FROM pipeline_audit_logs").
		WithArgs(testTenant, testRunID, 50, 0).
		WillReturnRows(sqlmock.NewRows([]string{}))

	logs, total, err := repo.GetAuditLogByPipeline(context.Background(), testTenant, testRunID, 0, 0)
	if err != nil {
		t.Fatalf("GetAuditLogByPipeline: %v", err)
	}
	if total != 0 {
		t.Fatalf("total = %d, want 0", total)
	}
	if len(logs) != 0 {
		t.Fatalf("logs len = %d, want 0", len(logs))
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unfulfilled expectations: %v", err)
	}
}

func TestRepository_GetAuditLogByPipeline_DefaultLimit(t *testing.T) {
	repo, mock, db := setupRepo(t)
	defer db.Close()

	mock.ExpectQuery("SELECT COUNT\\(\\*\\)").
		WithArgs(testTenant, testRunID).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectQuery("SELECT \\* FROM pipeline_audit_logs").
		WithArgs(testTenant, testRunID, 50, 0).
		WillReturnRows(sqlmock.NewRows([]string{}))

	_, _, err := repo.GetAuditLogByPipeline(context.Background(), testTenant, testRunID, 0, -1)
	if err != nil {
		t.Fatalf("GetAuditLogByPipeline: %v", err)
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unfulfilled expectations: %v", err)
	}
}

func TestRepository_GetAuditLogByAction_OK(t *testing.T) {
	repo, mock, db := setupRepo(t)
	defer db.Close()

	action := "deploy"
	createdAt := time.Now().UTC()
	rows := sqlmock.NewRows([]string{
		"id", "tenant_id", "run_id", "stage_id", "task_id",
		"action", "actor", "outcome", "duration_ms",
		"input_summary", "output_summary", "error_message", "metadata",
		"resource_type", "resource_id", "details", "ip_address",
		"created_at",
	}).AddRow(
		"log-id-1", testTenant, testRunID, nil, nil,
		action, "user-a", "success", int64(500),
		nil, nil, nil, "{}",
		"service", "svc-001", "rollback triggered", "192.168.1.1",
		createdAt,
	)

	mock.ExpectQuery("SELECT COUNT\\(\\*\\)").
		WithArgs(testTenant, action).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
	mock.ExpectQuery("SELECT \\* FROM pipeline_audit_logs").
		WithArgs(testTenant, action, 25, 0).
		WillReturnRows(rows)

	logs, total, err := repo.GetAuditLogByAction(context.Background(), testTenant, action, 25, 0)
	if err != nil {
		t.Fatalf("GetAuditLogByAction: %v", err)
	}
	if total != 1 {
		t.Fatalf("total = %d, want 1", total)
	}
	if len(logs) != 1 {
		t.Fatalf("logs len = %d, want 1", len(logs))
	}
	if logs[0].Action != action {
		t.Fatalf("Action = %s, want %s", logs[0].Action, action)
	}
	if logs[0].IPAddress == nil || *logs[0].IPAddress != "192.168.1.1" {
		t.Fatalf("IPAddress = %v, want 192.168.1.1", logs[0].IPAddress)
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unfulfilled expectations: %v", err)
	}
}

func TestRepository_GetAuditLogByAction_Empty(t *testing.T) {
	repo, mock, db := setupRepo(t)
	defer db.Close()

	mock.ExpectQuery("SELECT COUNT\\(\\*\\)").
		WithArgs(testTenant, "unknown").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectQuery("SELECT \\* FROM pipeline_audit_logs").
		WithArgs(testTenant, "unknown", 50, 0).
		WillReturnRows(sqlmock.NewRows([]string{}))

	logs, total, err := repo.GetAuditLogByAction(context.Background(), testTenant, "unknown", 0, 0)
	if err != nil {
		t.Fatalf("GetAuditLogByAction: %v", err)
	}
	if total != 0 {
		t.Fatalf("total = %d, want 0", total)
	}
	if len(logs) != 0 {
		t.Fatalf("logs len = %d, want 0", len(logs))
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unfulfilled expectations: %v", err)
	}
}

func TestRepository_GetAuditLogByAction_CapsLimit(t *testing.T) {
	repo, mock, db := setupRepo(t)
	defer db.Close()

	mock.ExpectQuery("SELECT COUNT\\(\\*\\)").
		WithArgs(testTenant, "deploy").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectQuery("SELECT \\* FROM pipeline_audit_logs").
		WithArgs(testTenant, "deploy", 50, 0).
		WillReturnRows(sqlmock.NewRows([]string{}))

	_, _, err := repo.GetAuditLogByAction(context.Background(), testTenant, "deploy", 1000, 0)
	if err != nil {
		t.Fatalf("GetAuditLogByAction: %v", err)
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unfulfilled expectations: %v", err)
	}
}

func TestRepository_Record_NewColumns(t *testing.T) {
	// This test validates that new fields (resource_type, resource_id, details,
	// ip_address) are correctly represented on the AuditLog model struct.
	log := &models.AuditLog{
		TenantID:     testTenant,
		RunID:        testRunID,
		Action:       "deploy",
		Actor:        "user-a",
		Outcome:      "success",
		ResourceType: strPtr("pipeline"),
		ResourceID:   strPtr("pipeline-abc"),
		Details:      strPtr("deployed v1.2.3 to production"),
		IPAddress:    strPtr("10.0.0.1"),
	}
	// New fields must be present and non-nil for the new INSERT columns.
	if log.ResourceType == nil {
		t.Fatal("ResourceType must be non-nil")
	}
	if *log.ResourceType != "pipeline" {
		t.Fatalf("ResourceType = %s, want pipeline", *log.ResourceType)
	}
	if log.ResourceID == nil {
		t.Fatal("ResourceID must be non-nil")
	}
	if *log.ResourceID != "pipeline-abc" {
		t.Fatalf("ResourceID = %s, want pipeline-abc", *log.ResourceID)
	}
	if log.Details == nil {
		t.Fatal("Details must be non-nil")
	}
	if *log.Details != "deployed v1.2.3 to production" {
		t.Fatalf("Details = %s, want 'deployed v1.2.3 to production'", *log.Details)
	}
	if log.IPAddress == nil {
		t.Fatal("IPAddress must be non-nil")
	}
	if *log.IPAddress != "10.0.0.1" {
		t.Fatalf("IPAddress = %s, want 10.0.0.1", *log.IPAddress)
	}
}

func strPtr(s string) *string {
	return &s
}
