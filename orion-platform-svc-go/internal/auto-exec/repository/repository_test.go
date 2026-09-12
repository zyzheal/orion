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

func executionTaskRow() *sqlmock.Rows {
	return sqlmock.NewRows([]string{
		"id", "tenant_id", "name", "type", "plugin", "plugin_params", "status",
		"retry_count", "max_retries", "timeout", "output", "error",
		"created_at", "updated_at", "started_at", "finished_at",
	}).AddRow(
		"task-42", "tenant-a", "nightly-build", "plugin", "shell", "{}", "running",
		0, 3, 300, "", "",
		time.Now().UTC(), time.Now().UTC(), nil, nil,
	)
}

// UpdateTask generated its SET clause from the field names but sent only the
// WHERE-clause keys as arguments, so sqlx failed with
// "could not find name status in map[string]interface{}{...}" before the UPDATE
// was ever issued. The engine logs and swallows that error, which left every
// executed task stuck at "pending" with no output and no finish time in the DB.
func TestUpdateTaskPersistsEveryField(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectExec(`UPDATE execution_tasks SET`).WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery(`SELECT \* FROM execution_tasks`).WillReturnRows(executionTaskRow())

	now := time.Now().UTC()
	task, err := repo.UpdateTask(context.Background(), "tenant-a", "task-42", map[string]interface{}{
		"status":     "running",
		"started_at": &now,
		"updated_at": now,
	})
	if err != nil {
		t.Fatalf("UpdateTask: %v: every field in the SET clause must be in the argument map", err)
	}
	if task == nil {
		t.Fatal("UpdateTask returned a nil task")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the UPDATE was never issued: %v", err)
	}
}

// The table's "error" column is a SQL keyword; it must survive the same path.
func TestUpdateTaskPersistsErrorAndRetryFields(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectExec(`UPDATE execution_tasks SET`).WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery(`SELECT \* FROM execution_tasks`).WillReturnRows(executionTaskRow())

	now := time.Now().UTC()
	_, err := repo.UpdateTask(context.Background(), "tenant-a", "task-42", map[string]interface{}{
		"status":      "failed",
		"error":       "boom",
		"retry_count": 2,
		"finished_at": &now,
		"updated_at":  now,
	})
	if err != nil {
		t.Fatalf("UpdateTask: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the UPDATE was never issued: %v", err)
	}
}

// An empty field set must be a re-read, not an `UPDATE ... SET ` statement with
// nothing to set.
func TestUpdateTaskWithNoFieldsRereads(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectQuery(`SELECT \* FROM execution_tasks`).WillReturnRows(executionTaskRow())

	task, err := repo.UpdateTask(context.Background(), "tenant-a", "task-42", nil)
	if err != nil {
		t.Fatalf("UpdateTask: %v", err)
	}
	if task.Status != "running" {
		t.Fatalf("task.Status = %q, want the stored value", task.Status)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected SQL: %v", err)
	}
}

func pluginRow() *sqlmock.Rows {
	return sqlmock.NewRows([]string{
		"id", "tenant_id", "name", "category", "description", "params", "enabled",
		"created_at", "updated_at",
	}).AddRow(
		"p-1", "tenant-a", "shell", "process", "runs a shell command", `{"k":"v"}`, true,
		time.Now().UTC(), time.Now().UTC(),
	)
}

// UpdatePlugin had the same defect as UpdateTask, so PUT /plugins/:id — the only
// routed auto-exec write — always returned 500 and plugin edits were lost.
func TestUpdatePluginPersistsEveryField(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectExec(`UPDATE plugin_spi SET`).WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery(`SELECT id, tenant_id, name, category, description, params, enabled, created_at, updated_at FROM plugin_spi WHERE name=\$1`).
		WillReturnRows(pluginRow())

	enabled := true
	plugin, err := repo.UpdatePlugin(context.Background(), "tenant-a", "shell", map[string]interface{}{
		"category":    "integration",
		"description": "runs a shell command on the runner",
		"enabled":     enabled,
	})
	if err != nil {
		t.Fatalf("UpdatePlugin: %v: every field in the SET clause must be in the argument map", err)
	}
	if plugin == nil || plugin.Name != "shell" {
		t.Fatalf("UpdatePlugin returned %+v, want the updated plugin", plugin)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the UPDATE was never issued: %v", err)
	}
}
