package repository

import (
	"context"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

func newMockRepo(t *testing.T) (sqlmock.Sqlmock, *Repository) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return mock, NewRepository(sqlx.NewDb(db, "postgres"))
}

func jobActionRow() *sqlmock.Rows {
	return sqlmock.NewRows([]string{
		"id", "tenant_id", "name", "type", "description", "params", "category",
		"timeout", "retry_count", "enabled", "created_at", "updated_at",
	}).AddRow(
		"a-1", "tenant-a", "restart-web", "restart", "restarts the web pods", "{}", "deployment",
		300, 0, true, time.Now().UTC(), time.Now().UTC(),
	)
}

// UpdateAction generated its SET clause from the field names but sent only the
// WHERE-clause keys, so sqlx failed with
// "could not find name enabled in map[string]interface{}{...}" before the UPDATE
// was issued. Asserting err == nil is what makes the test non-vacuous: that is
// exactly the error the broken code returned.
func TestUpdateActionPersistsEveryField(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectExec(`UPDATE job_actions SET`).WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery(`SELECT \* FROM job_actions`).WillReturnRows(jobActionRow())

	action, err := repo.UpdateAction(context.Background(), "tenant-a", "a-1", map[string]interface{}{
		"enabled":     false,
		"retry_count": 2,
		"timeout":     600,
	})
	if err != nil {
		t.Fatalf("UpdateAction: %v: every field in the SET clause must be in the argument map", err)
	}
	if action == nil || action.ID != "a-1" {
		t.Fatalf("UpdateAction returned %+v, want the updated action", action)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the UPDATE was never issued: %v", err)
	}
}

func TestUpdateActionWithNoFieldsRereads(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectQuery(`SELECT \* FROM job_actions`).WillReturnRows(jobActionRow())

	action, err := repo.UpdateAction(context.Background(), "tenant-a", "a-1", nil)
	if err != nil {
		t.Fatalf("UpdateAction: %v", err)
	}
	if action.Enabled != true {
		t.Fatalf("action.Enabled = %v, want the stored value", action.Enabled)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected SQL: %v", err)
	}
}

func executionRow() *sqlmock.Rows {
	return sqlmock.NewRows([]string{
		"id", "tenant_id", "action_id", "params", "status", "output", "error",
		"duration_ms", "started_at", "finished_at", "created_at",
	}).AddRow(
		"e-1", "tenant-a", "a-1", "{}", "succeeded", "pods restarted", "",
		int64(1234), time.Now().UTC(), nil, time.Now().UTC(),
	)
}

// finalizeExecution in the job-actions service calls UpdateExecution on every
// execution and only logs the error, so the broken arg map meant no execution
// ever reached a terminal status in the DB.
func TestUpdateExecutionPersistsTerminalState(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectExec(`UPDATE job_action_executions SET`).WillReturnResult(sqlmock.NewResult(0, 1))

	finished := time.Now().UTC()
	err := repo.UpdateExecution(context.Background(), "tenant-a", "e-1", map[string]interface{}{
		"status":      "succeeded",
		"output":      "pods restarted",
		"error":       "",
		"duration_ms": int64(1234),
		"finished_at": &finished,
	})
	if err != nil {
		t.Fatalf("UpdateExecution: %v: the finalize path can never persist state", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the UPDATE was never issued: %v", err)
	}
}

// An empty field set must not emit "UPDATE ... SET  WHERE ..." (a syntax error).
func TestUpdateExecutionWithNoFieldsIsANoOp(t *testing.T) {
	mock, repo := newMockRepo(t)

	if err := repo.UpdateExecution(context.Background(), "tenant-a", "e-1", nil); err != nil {
		t.Fatalf("UpdateExecution: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected SQL: %v", err)
	}
}
