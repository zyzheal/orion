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

// ==================== P1: stage/task/job 单点租户隔离 ====================

// stage_executions and task_executions have no tenant_id column, so reads are
// scoped by JOINing pipeline_runs and filtering on its tenant_id. A
// cross-tenant lookup must come back as sql.ErrNoRows.

func TestGetStageExecutionByID_ScopedToTenant(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()
	r := NewRepository(sqlx.NewDb(db, "postgres"))

	mock.ExpectQuery(`SELECT se\.\* FROM stage_executions se JOIN pipeline_runs r ON se\.run_id = r\.id WHERE se\.id=\$1 AND r\.tenant_id=\$2`).
		WithArgs("stage-1", "t-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "run_id", "stage_name", "status"}).
			AddRow("stage-1", "run-1", "build", "running"))

	se, err := r.GetStageExecutionByID(context.Background(), "stage-1", "t-1")
	if err != nil {
		t.Fatalf("GetStageExecutionByID: %v", err)
	}
	if se.StageName != "build" {
		t.Errorf("stage_name = %q, want build", se.StageName)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestGetStageExecutionByID_WrongTenant_NoRows(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()
	r := NewRepository(sqlx.NewDb(db, "postgres"))

	mock.ExpectQuery(`SELECT se\.\* FROM stage_executions se JOIN pipeline_runs r ON se\.run_id = r\.id WHERE se\.id=\$1 AND r\.tenant_id=\$2`).
		WithArgs("stage-1", "t-2").
		WillReturnError(sql.ErrNoRows)

	_, err = r.GetStageExecutionByID(context.Background(), "stage-1", "t-2")
	if err != sql.ErrNoRows {
		t.Fatalf("err = %v, want sql.ErrNoRows for cross-tenant access", err)
	}
}

func TestGetTaskExecutionByID_ScopedToTenant(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()
	r := NewRepository(sqlx.NewDb(db, "postgres"))

	mock.ExpectQuery(`SELECT te\.\* FROM task_executions te JOIN stage_executions se ON te\.execution_id = se\.id JOIN pipeline_runs r ON se\.run_id = r\.id WHERE te\.id=\$1 AND r\.tenant_id=\$2`).
		WithArgs("task-1", "t-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "execution_id", "task_name", "status"}).
			AddRow("task-1", "stage-1", "deploy", "pending"))

	te, err := r.GetTaskExecutionByID(context.Background(), "task-1", "t-1")
	if err != nil {
		t.Fatalf("GetTaskExecutionByID: %v", err)
	}
	if te.TaskName != "deploy" {
		t.Errorf("task_name = %q, want deploy", te.TaskName)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestGetTaskExecutionByID_WrongTenant_NoRows(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()
	r := NewRepository(sqlx.NewDb(db, "postgres"))

	mock.ExpectQuery(`SELECT te\.\* FROM task_executions te JOIN stage_executions se ON te\.execution_id = se\.id JOIN pipeline_runs r ON se\.run_id = r\.id WHERE te\.id=\$1 AND r\.tenant_id=\$2`).
		WithArgs("task-1", "t-2").
		WillReturnError(sql.ErrNoRows)

	_, err = r.GetTaskExecutionByID(context.Background(), "task-1", "t-2")
	if err != sql.ErrNoRows {
		t.Fatalf("err = %v, want sql.ErrNoRows for cross-tenant access", err)
	}
}

func TestUpdateStageExecutionStatus_ScopedToTenant(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()
	r := NewRepository(sqlx.NewDb(db, "postgres"))

	// The UPDATE carries an EXISTS tenant check; a cross-tenant id must match
	// no rows and leave the row untouched.
	mock.ExpectQuery(`UPDATE stage_executions SET status=\$2 WHERE id=\$1 AND EXISTS \(SELECT 1 FROM pipeline_runs r WHERE r\.id = stage_executions\.run_id AND r\.tenant_id = \$3\) RETURNING \*`).
		WithArgs("stage-1", "success", "t-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "run_id", "stage_name", "status"}).
			AddRow("stage-1", "run-1", "build", "success"))

	se, err := r.UpdateStageExecutionStatus(context.Background(), "stage-1", "success", nil, nil, nil, nil, "t-1")
	if err != nil {
		t.Fatalf("UpdateStageExecutionStatus: %v", err)
	}
	if se.Status != "success" {
		t.Errorf("status = %q, want success", se.Status)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestUpdateTaskExecutionStatus_ScopedToTenant(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()
	r := NewRepository(sqlx.NewDb(db, "postgres"))

	mock.ExpectQuery(`UPDATE task_executions SET status=\$2 WHERE id=\$1 AND EXISTS \(SELECT 1 FROM stage_executions se JOIN pipeline_runs r ON se\.run_id = r\.id WHERE se\.id = task_executions\.execution_id AND r\.tenant_id = \$3\) RETURNING \*`).
		WithArgs("task-1", "running", "t-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "execution_id", "task_name", "status"}).
			AddRow("task-1", "stage-1", "deploy", "running"))

	te, err := r.UpdateTaskExecutionStatus(context.Background(), "task-1",
		map[string]interface{}{"status": "running"}, "t-1")
	if err != nil {
		t.Fatalf("UpdateTaskExecutionStatus: %v", err)
	}
	if te.Status != "running" {
		t.Errorf("status = %q, want running", te.Status)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// runner_jobs has its own tenant_id column, so every read/write carries an
// explicit tenant condition instead of a JOIN.

func TestGetRunnerJobByID_ScopedToTenant(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()
	r := NewRepository(sqlx.NewDb(db, "postgres"))

	mock.ExpectQuery(`SELECT \* FROM runner_jobs WHERE id=\$1 AND tenant_id=\$2`).
		WithArgs("job-1", "t-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "runner_id", "task_id", "tenant_id", "status"}).
			AddRow("job-1", "runner-1", "task-1", "t-1", "pending"))

	job, err := r.GetRunnerJobByID(context.Background(), "job-1", "t-1")
	if err != nil {
		t.Fatalf("GetRunnerJobByID: %v", err)
	}
	if job.ID != "job-1" {
		t.Errorf("id = %q, want job-1", job.ID)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestGetRunnerJobByID_WrongTenant_NoRows(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()
	r := NewRepository(sqlx.NewDb(db, "postgres"))

	mock.ExpectQuery(`SELECT \* FROM runner_jobs WHERE id=\$1 AND tenant_id=\$2`).
		WithArgs("job-1", "t-2").
		WillReturnError(sql.ErrNoRows)

	_, err = r.GetRunnerJobByID(context.Background(), "job-1", "t-2")
	if err != sql.ErrNoRows {
		t.Fatalf("err = %v, want sql.ErrNoRows for cross-tenant access", err)
	}
}

func TestListRunnerJobsByRunner_ScopedToTenant(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()
	r := NewRepository(sqlx.NewDb(db, "postgres"))

	mock.ExpectQuery(`SELECT \* FROM runner_jobs WHERE runner_id=\$1 AND tenant_id=\$2 ORDER BY created_at DESC`).
		WithArgs("runner-1", "t-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "runner_id", "task_id", "tenant_id", "status"}))

	jobs, err := r.ListRunnerJobsByRunner(context.Background(), "runner-1", "t-1")
	if err != nil {
		t.Fatalf("ListRunnerJobsByRunner: %v", err)
	}
	if len(jobs) != 0 {
		t.Errorf("len(jobs) = %d, want 0 (empty result set)", len(jobs))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestMarkRunnerJobStarted_ScopedToTenant(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()
	r := NewRepository(sqlx.NewDb(db, "postgres"))

	mock.ExpectQuery(`UPDATE runner_jobs SET status='running', started_at=COALESCE\(started_at, NOW\(\)\) WHERE id=\$1 AND tenant_id=\$2 RETURNING \*`).
		WithArgs("job-1", "t-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "runner_id", "tenant_id", "status"}).
			AddRow("job-1", "runner-1", "t-1", "running"))

	job, err := r.MarkRunnerJobStarted(context.Background(), "job-1", "t-1")
	if err != nil {
		t.Fatalf("MarkRunnerJobStarted: %v", err)
	}
	if job.Status != "running" {
		t.Errorf("status = %q, want running", job.Status)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestMarkRunnerJobComplete_ScopedToTenant(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()
	r := NewRepository(sqlx.NewDb(db, "postgres"))

	mock.ExpectQuery(`UPDATE runner_jobs SET status='completed', result=\$3, completed_at=NOW\(\) WHERE id=\$1 AND tenant_id=\$2 RETURNING \*`).
		WithArgs("job-1", "t-1", `{"ok":true}`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "runner_id", "tenant_id", "status"}).
			AddRow("job-1", "runner-1", "t-1", "completed"))

	job, err := r.MarkRunnerJobComplete(context.Background(), "job-1", "t-1", map[string]interface{}{"ok": true})
	if err != nil {
		t.Fatalf("MarkRunnerJobComplete: %v", err)
	}
	if job.Status != "completed" {
		t.Errorf("status = %q, want completed", job.Status)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestMarkRunnerJobFailed_ScopedToTenant(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()
	r := NewRepository(sqlx.NewDb(db, "postgres"))

	mock.ExpectQuery(`UPDATE runner_jobs SET status='failed', error=\$3, completed_at=NOW\(\) WHERE id=\$1 AND tenant_id=\$2 RETURNING \*`).
		WithArgs("job-1", "t-1", "boom").
		WillReturnRows(sqlmock.NewRows([]string{"id", "runner_id", "tenant_id", "status"}).
			AddRow("job-1", "runner-1", "t-1", "failed"))

	job, err := r.MarkRunnerJobFailed(context.Background(), "job-1", "t-1", "boom")
	if err != nil {
		t.Fatalf("MarkRunnerJobFailed: %v", err)
	}
	if job.Status != "failed" {
		t.Errorf("status = %q, want failed", job.Status)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestDeleteRunnerJob_ScopedToTenant(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()
	r := NewRepository(sqlx.NewDb(db, "postgres"))

	mock.ExpectExec(`DELETE FROM runner_jobs WHERE id=\$1 AND tenant_id=\$2`).
		WithArgs("job-1", "t-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := r.DeleteRunnerJob(context.Background(), "job-1", "t-1"); err != nil {
		t.Fatalf("DeleteRunnerJob: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}