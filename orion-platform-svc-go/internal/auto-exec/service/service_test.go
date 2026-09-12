package service

import (
	"context"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"

	"orion/platform-svc-go/internal/auto-exec/engine"
	"orion/platform-svc-go/internal/auto-exec/models"
	"orion/platform-svc-go/internal/auto-exec/repository"
)

// recordingPlugin records the params it was executed with so tests can prove
// that per-run overrides reach the plugin.
type recordingPlugin struct {
	params map[string]string
}

func (p *recordingPlugin) Name() string     { return "shell" }
func (p *recordingPlugin) Category() string { return "process" }
func (p *recordingPlugin) Execute(ctx context.Context, params map[string]string, task *models.ExecutionTask) (string, error) {
	p.params = params
	return "ok", nil
}
func (p *recordingPlugin) Validate(ctx context.Context, params map[string]string) error { return nil }

// newMockService builds the real service over a sqlmock database, so the tests
// exercise the actual repository SQL instead of a hand-rolled fake.
func newMockService(t *testing.T) (sqlmock.Sqlmock, *Service, *recordingPlugin) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	repo := repository.NewRepository(sqlx.NewDb(db, "postgres"))
	plugin := &recordingPlugin{}
	eng := engine.NewAutoExecEngine(repo, zap.NewNop())
	eng.RegisterPlugin(plugin)
	return mock, NewService(eng, repo), plugin
}

func taskRow() *sqlmock.Rows {
	return sqlmock.NewRows([]string{
		"id", "tenant_id", "name", "type", "plugin", "plugin_params", "status",
		"retry_count", "max_retries", "timeout", "output", "error",
		"created_at", "updated_at", "started_at", "finished_at",
	}).AddRow(
		"task-42", "tenant-a", "nightly-build", "plugin", "shell",
		`{"command":"echo built","env":"dev"}`, "pending",
		0, 7, 900, "", "",
		time.Now().UTC(), time.Now().UTC(), nil, nil,
	)
}

// CreateTask used to forward only Name/Plugin/PluginParams to the engine, so
// MaxRetries and Timeout were lost. The repository then clamped the zero
// timeout into [1, 3600], persisting a task that ran once for one second.
// expectRunFlow queues the SQL a successful run produces, in the order the
// engine issues it: load the task, mark it running (UPDATE then re-read),
// execute, persist the result (UPDATE then re-read), write history. The task
// lookup is pinned to the caller's tenant, so a hard-coded tenant fails the
// arg check and the test reports it.
func expectRunFlow(mock sqlmock.Sqlmock) {
	mock.ExpectQuery(`SELECT \* FROM execution_tasks WHERE id=\$1 AND tenant_id=\$2`).
		WithArgs("task-42", "tenant-a").
		WillReturnRows(taskRow())
	mock.ExpectExec("UPDATE execution_tasks SET").WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery(`SELECT \* FROM execution_tasks WHERE id=\$1 AND tenant_id=\$2`).
		WithArgs("task-42", "tenant-a").
		WillReturnRows(taskRow())
	mock.ExpectExec("UPDATE execution_tasks SET").WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery(`SELECT \* FROM execution_tasks WHERE id=\$1 AND tenant_id=\$2`).
		WithArgs("task-42", "tenant-a").
		WillReturnRows(taskRow())
	mock.ExpectExec("INSERT INTO execution_history").WillReturnResult(sqlmock.NewResult(0, 1))
}

func TestCreateTaskPropagatesRetryPolicyAndTimeout(t *testing.T) {
	mock, svc, _ := newMockService(t)
	mock.ExpectExec("INSERT INTO execution_tasks").WillReturnResult(sqlmock.NewResult(1, 1))

	task, err := svc.CreateTask(context.Background(), "tenant-a", models.CreateTaskRequest{
		Name:         "nightly-build",
		Type:         "plugin",
		Plugin:       "shell",
		PluginParams: map[string]string{"command": "echo built"},
		MaxRetries:   7,
		Timeout:      900,
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}
	if task.MaxRetries != 7 {
		t.Fatalf("stored MaxRetries = %d, want 7: the retry policy was dropped", task.MaxRetries)
	}
	if task.Timeout != 900 {
		t.Fatalf("stored Timeout = %d, want 900: the requested timeout was dropped", task.Timeout)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected SQL: %v", err)
	}
}

// ExecuteTask used to resolve the tenant from ctx.Value("tenant_id"), a key no
// middleware ever sets, so every run looked the task up under tenant "system".
// The task lookup below is pinned to the caller's tenant: a hard-coded tenant
// makes the mock reject the query and the test fails.
func TestExecuteTaskLoadsTaskForAuthenticatedTenant(t *testing.T) {
	mock, svc, plugin := newMockService(t)
	expectRunFlow(mock)

	task, err := svc.ExecuteTask(context.Background(), "tenant-a", "task-42", &models.RunTaskRequest{
		Params: map[string]string{"env": "prod"},
	})
	if err != nil {
		t.Fatalf("ExecuteTask: %v", err)
	}
	if task.Status != models.StatusCompleted {
		t.Fatalf("task.Status = %q, want %q", task.Status, models.StatusCompleted)
	}
	if task.Output != "ok" {
		t.Fatalf("task.Output = %q, want the plugin output", task.Output)
	}
	if got := plugin.params["env"]; got != "prod" {
		t.Fatalf("override env = %q, want prod: per-run params were discarded", got)
	}
	if got := plugin.params["command"]; got != "echo built" {
		t.Fatalf("stored param command = %q, want it preserved", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected SQL: %v", err)
	}
}

// ExecuteTask without overrides must still use the stored plugin_params.
func TestExecuteTaskWithoutOverrides(t *testing.T) {
	mock, svc, plugin := newMockService(t)
	expectRunFlow(mock)

	if _, err := svc.ExecuteTask(context.Background(), "tenant-a", "task-42", nil); err != nil {
		t.Fatalf("ExecuteTask: %v", err)
	}
	if got := plugin.params["env"]; got != "dev" {
		t.Fatalf("env = %q, want dev from the stored plugin_params", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected SQL: %v", err)
	}
}
