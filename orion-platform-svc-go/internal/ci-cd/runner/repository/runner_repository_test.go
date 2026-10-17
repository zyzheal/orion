package repository

import (
	"context"
	"database/sql"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

func TestGetRunByID_ScopedToTenant(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()
	r := NewRepository(sqlx.NewDb(db, "postgres"))

	mock.ExpectQuery(`SELECT \* FROM pipeline_runs WHERE id=\$1 AND tenant_id=\$2`).
		WithArgs("run-1", "t-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "pipeline_id", "status"}).
			AddRow("run-1", "t-1", "p-1", "failed"))

	run, err := r.GetRunByID(context.Background(), "run-1", "t-1")
	if err != nil {
		t.Fatalf("GetRunByID: %v", err)
	}
	if run.Status != "failed" {
		t.Errorf("status = %q, want failed", run.Status)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestGetRunByID_WrongTenant_NoRows(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()
	r := NewRepository(sqlx.NewDb(db, "postgres"))

	// A run that exists but belongs to another tenant must come back as
	// sql.ErrNoRows so the service maps it to ErrRunNotFound — never to the
	// run's data.
	mock.ExpectQuery(`SELECT \* FROM pipeline_runs WHERE id=\$1 AND tenant_id=\$2`).
		WithArgs("run-1", "t-2").
		WillReturnError(sql.ErrNoRows)

	_, err = r.GetRunByID(context.Background(), "run-1", "t-2")
	if err != sql.ErrNoRows {
		t.Fatalf("err = %v, want sql.ErrNoRows for cross-tenant access", err)
	}
}

func TestDeleteRun_ScopedToTenant(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()
	r := NewRepository(sqlx.NewDb(db, "postgres"))

	mock.ExpectExec(`DELETE FROM pipeline_runs WHERE id=\$1 AND tenant_id=\$2`).
		WithArgs("run-1", "t-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := r.DeleteRun(context.Background(), "run-1", "t-1"); err != nil {
		t.Fatalf("DeleteRun: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestListStageExecutionsByRun_ValidatesRunTenant(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()
	r := NewRepository(sqlx.NewDb(db, "postgres"))

	// Run lookup must be tenant-scoped and must happen before stages are read.
	mock.ExpectQuery(`SELECT \* FROM pipeline_runs WHERE id=\$1 AND tenant_id=\$2`).
		WithArgs("run-1", "t-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "pipeline_id", "status"}).
			AddRow("run-1", "t-1", "p-1", "running"))
	mock.ExpectQuery(`SELECT \* FROM stage_executions WHERE run_id=\$1 ORDER BY created_at`).
		WithArgs("run-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "run_id", "stage_name", "status"}))

	stages, err := r.ListStageExecutionsByRun(context.Background(), "run-1", "t-1")
	if err != nil {
		t.Fatalf("ListStageExecutionsByRun: %v", err)
	}
	if len(stages) != 0 {
		t.Errorf("len(stages) = %d, want 0 (empty result set)", len(stages))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestListStageExecutionsByRun_WrongTenant_RejectedBeforeStages(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()
	r := NewRepository(sqlx.NewDb(db, "postgres"))

	// Cross-tenant: run lookup fails, no stage query is ever issued.
	mock.ExpectQuery(`SELECT \* FROM pipeline_runs WHERE id=\$1 AND tenant_id=\$2`).
		WithArgs("run-1", "t-2").
		WillReturnError(sql.ErrNoRows)

	_, err = r.ListStageExecutionsByRun(context.Background(), "run-1", "t-2")
	if err != sql.ErrNoRows {
		t.Fatalf("err = %v, want sql.ErrNoRows", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}