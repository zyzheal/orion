package repository

import (
	"context"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

func TestGetRunDetail_ScopedToTenant(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()
	r := NewRepository(sqlx.NewDb(db, "postgres"))

	// Run row must be fetched with a tenant_id condition — cross-tenant
	// disclosure is prevented at the SQL level, not in application code.
	mock.ExpectQuery(`SELECT id, status, started_at, completed_at FROM pipeline_runs WHERE id=\$1 AND tenant_id=\$2`).
		WithArgs("11111111-1111-1111-1111-111111111111", "t-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "status", "started_at", "completed_at"}).
			AddRow("11111111-1111-1111-1111-111111111111", "failed", nil, nil))
	mock.ExpectQuery(`SELECT name, error, started_at, completed_at FROM pipeline_stages WHERE run_id=\$1 ORDER BY sequence ASC`).
		WithArgs("11111111-1111-1111-1111-111111111111").
		WillReturnRows(sqlmock.NewRows([]string{"name", "error", "started_at", "completed_at"}))
	mock.ExpectQuery(`SELECT t.name, t.error, t.started_at, t.completed_at`).
		WillReturnRows(sqlmock.NewRows([]string{"name", "error", "started_at", "completed_at"}))

	detail, err := r.GetRunDetail(context.Background(), "11111111-1111-1111-1111-111111111111", "t-1")
	if err != nil {
		t.Fatalf("GetRunDetail: %v", err)
	}
	if detail.Run.Status != "failed" {
		t.Errorf("status = %q, want failed", detail.Run.Status)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestGetRunDetail_WrongTenant_NotFound(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()
	r := NewRepository(sqlx.NewDb(db, "postgres"))

	// Simulates a run that exists but belongs to another tenant — the
	// tenant-scoped WHERE returns no rows and the caller sees ErrRunNotFound
	// instead of the run's data.
	mock.ExpectQuery(`SELECT id, status, started_at, completed_at FROM pipeline_runs WHERE id=\$1 AND tenant_id=\$2`).
		WithArgs("11111111-1111-1111-1111-111111111111", "t-2").
		WillReturnRows(sqlmock.NewRows([]string{"id", "status", "started_at", "completed_at"}))

	_, err = r.GetRunDetail(context.Background(), "11111111-1111-1111-1111-111111111111", "t-2")
	if err != ErrRunNotFound {
		t.Fatalf("err = %v, want ErrRunNotFound for cross-tenant access", err)
	}
}