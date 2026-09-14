package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"

	"orion/platform-svc-go/internal/job-actions/models"
	"orion/platform-svc-go/internal/job-actions/repository"
)

// Every test drives the executor against a sqlmock repository, so the
// assertions below are about what the executor writes to the audit table,
// which is the surface a caller can actually observe.

func newMockRepo(t *testing.T) (sqlmock.Sqlmock, *repository.Repository) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return mock, repository.NewRepository(sqlx.NewDb(db, "postgres"))
}

func newTestExecutor(repo *repository.Repository) *JobActionExecutor {
	return NewJobActionExecutor(repo, nil)
}

// actionRows declares the columns ListActions selects. An empty row set makes
// ExecuteAction fall through to executeByType, which is the path under test.
func actionRows() *sqlmock.Rows {
	return sqlmock.NewRows([]string{
		"id", "tenant_id", "name", "type", "description", "params", "category",
		"timeout", "retry_count", "enabled", "created_at", "updated_at",
	})
}

// expectNoPersistedActions makes ListActions return an empty page.
func expectNoPersistedActions(mock sqlmock.Sqlmock, tenant string) {
	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM job_actions`).
		WithArgs(tenant).
		WillReturnRows(sqlmock.NewRows([]string{"COUNT(*)"}).AddRow(0))
	mock.ExpectQuery(`FROM job_actions WHERE tenant_id`).
		WillReturnRows(actionRows())
}

// ---------------------------------------------------------------------------
// Defect: every built-in handler used to answer Success=true with output
// "[<type>] executed" and a ~0 ms duration, and the executor then recorded
// status='completed' for it. The audit row claimed work that never happened.
// ---------------------------------------------------------------------------

func TestBuiltinHandlersNeverClaimSuccess(t *testing.T) {
	_, repo := newMockRepo(t)
	exec := newTestExecutor(repo)

	exec.mu.RLock()
	handlers := make([]IJobActionHandler, 0, len(exec.handlers))
	for _, h := range exec.handlers {
		handlers = append(handlers, h)
	}
	exec.mu.RUnlock()

	if len(handlers) != len(models.AllActionTypes) {
		t.Fatalf("registry holds %d handlers, models.AllActionTypes declares %d",
			len(handlers), len(models.AllActionTypes))
	}
	for _, h := range handlers {
		if h.Type() == "" {
			t.Fatal("a registered handler has an empty Type()")
		}
		if _, err := h.Execute(context.Background(), nil); !errors.Is(err, ErrActionNotImplemented) {
			t.Errorf("handler %q: Execute returned %v, want an error wrapping ErrActionNotImplemented", h.Type(), err)
		}
	}
}

func TestEveryDeclaredTypeIsRegisteredAndViceVersa(t *testing.T) {
	_, repo := newMockRepo(t)
	exec := newTestExecutor(repo)

	declared := make(map[string]struct{}, len(models.AllActionTypes))
	for _, typ := range models.AllActionTypes {
		declared[typ] = struct{}{}
	}

	exec.mu.RLock()
	defer exec.mu.RUnlock()

	if len(exec.handlers) != len(declared) {
		t.Fatalf("registry holds %d handlers for %d declared types", len(exec.handlers), len(declared))
	}
	for key, h := range exec.handlers {
		if _, ok := declared[key]; !ok {
			t.Errorf("handler registered under undeclared type %q", key)
		}
		if h.Type() != key {
			t.Errorf("handler Type() = %q but it is registered under %q", h.Type(), key)
		}
	}
	for _, typ := range models.AllActionTypes {
		if _, ok := exec.handlers[typ]; !ok {
			t.Errorf("declared type %q has no handler", typ)
		}
	}
}

// The audit row is where the lie used to live. This test asserts the failed
// row is the one that ends up written.
func TestExecuteActionRecordsFailedForUnimplementedBackend(t *testing.T) {
	mock, repo := newMockRepo(t)
	expectNoPersistedActions(mock, "tenant-a")
	mock.ExpectExec(`INSERT INTO job_action_executions`).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectExec(`UPDATE job_action_executions SET .*started_at`).WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(`UPDATE job_action_executions SET .*finished_at`).WillReturnResult(sqlmock.NewResult(0, 1))
	exec := newTestExecutor(repo)

	ex, err := exec.ExecuteAction(context.Background(), "tenant-a", models.TypeRestartService, map[string]string{"service": "web"})
	if err == nil {
		t.Fatal("ExecuteAction returned a nil error for an action with no backend")
	}
	if !errors.Is(err, ErrActionNotImplemented) {
		t.Fatalf("err = %v, want an error wrapping ErrActionNotImplemented", err)
	}
	if ex == nil {
		t.Fatal("ex = nil: the execution record must be returned so the caller can see it was recorded")
	}
	if ex.Status != models.StatusFailed {
		t.Fatalf("ex.Status = %q, want %q: the audit row must not claim a completed run", ex.Status, models.StatusFailed)
	}
	if ex.Error == "" {
		t.Fatal("ex.Error is empty: the row must say why the run did not happen")
	}
	if !strings.Contains(ex.Error, "not implemented") {
		t.Fatalf("ex.Error = %q, want it to mention that the action is not implemented", ex.Error)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the execution was not recorded the way the code claims: %v", err)
	}
}

// A persisted, enabled definition must be treated the same way as an ad-hoc
// type dispatch: the row exists, the type is known, and it still ends failed.
func TestExecuteActionFailsForPersistedActionWithoutBackend(t *testing.T) {
	mock, repo := newMockRepo(t)

	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM job_actions`).
		WithArgs("tenant-a").
		WillReturnRows(sqlmock.NewRows([]string{"COUNT(*)"}).AddRow(1))
	mock.ExpectQuery(`FROM job_actions WHERE tenant_id`).
		WillReturnRows(actionRows().AddRow(
			"a-1", "tenant-a", "restart-web", models.TypeRestartService, "", "{}", models.CategoryDeployment,
			300, 0, true, time.Now().UTC(), time.Now().UTC(),
		))
	mock.ExpectExec(`INSERT INTO job_action_executions`).WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectExec(`UPDATE job_action_executions SET .*started_at`).WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(`UPDATE job_action_executions SET .*finished_at`).WillReturnResult(sqlmock.NewResult(0, 1))
	exec := newTestExecutor(repo)

	ex, err := exec.ExecuteAction(context.Background(), "tenant-a", "restart-web", nil)
	if !errors.Is(err, ErrActionNotImplemented) {
		t.Fatalf("err = %v, want ErrActionNotImplemented", err)
	}
	if ex == nil || ex.Status != models.StatusFailed {
		t.Fatalf("ex = %+v, want status %q", ex, models.StatusFailed)
	}
	if ex.ActionID != "a-1" {
		t.Fatalf("ex.ActionID = %q, want the persisted action id a-1", ex.ActionID)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected SQL: %v", err)
	}
}

// Retrying a permanent failure would only multiply the warning log and the
// row's duration by RetryCount+1 without any chance of success.
type countingHandler struct {
	typ   string
	calls *int
	err   error
}

func (h *countingHandler) Name() string                                      { return h.typ }
func (h *countingHandler) Type() string                                      { return h.typ }
func (h *countingHandler) Category() string                                  { return models.CategoryDeployment }
func (h *countingHandler) Validate(context.Context, map[string]string) error { return nil }
func (h *countingHandler) Execute(context.Context, map[string]string) (*ActionResult, error) {
	*h.calls++
	return nil, h.err
}

func TestRunWithRetriesStopsOnPermanentError(t *testing.T) {
	_, repo := newMockRepo(t)
	exec := newTestExecutor(repo)

	var calls int
	h := &countingHandler{typ: models.TypeRollback, calls: &calls,
		err: fmt.Errorf("%w: %s", ErrActionNotImplemented, models.TypeRollback)}

	_, err := exec.runWithRetries(context.Background(), h, nil, 5)
	if !errors.Is(err, ErrActionNotImplemented) {
		t.Fatalf("err = %v, want ErrActionNotImplemented", err)
	}
	if calls != 1 {
		t.Fatalf("handler ran %d times with retries=5, want 1: a permanent failure cannot be fixed by another attempt", calls)
	}
}

// The permanent-error short-circuit must be narrow: transient failures still
// get every attempt they were promised.
func TestRunWithRetriesStillRetriesTransientErrors(t *testing.T) {
	_, repo := newMockRepo(t)
	exec := newTestExecutor(repo)

	transient := errors.New("connection refused")
	var calls int
	h := &countingHandler{typ: models.TypeKubectlApply, calls: &calls, err: transient}

	_, err := exec.runWithRetries(context.Background(), h, nil, 2)
	if !errors.Is(err, transient) {
		t.Fatalf("err = %v, want the last transient error", err)
	}
	if calls != 3 {
		t.Fatalf("handler ran %d times with retries=2, want 3", calls)
	}
}

// Validate still gates execution, so a handler that rejects its params never
// reaches Execute at all.
func TestRunWithRetriesHonoursValidation(t *testing.T) {
	_, repo := newMockRepo(t)
	exec := newTestExecutor(repo)

	var calls int
	h := &countingHandler{typ: models.TypeRunScript, calls: &calls, err: errors.New("validation: path is required")}

	_, err := exec.runWithRetries(context.Background(), &validatorHandler{h, errors.New("path is required")}, nil, 3)
	if err == nil {
		t.Fatal("expected the validation error to be returned")
	}
	if calls != 0 {
		t.Fatalf("handler ran %d times, want 0: validation must gate execution", calls)
	}
}

type validatorHandler struct {
	next IJobActionHandler
	vErr error
}

func (v *validatorHandler) Name() string                                      { return v.next.Name() }
func (v *validatorHandler) Type() string                                      { return v.next.Type() }
func (v *validatorHandler) Category() string                                  { return v.next.Category() }
func (v *validatorHandler) Validate(context.Context, map[string]string) error { return v.vErr }
func (v *validatorHandler) Execute(ctx context.Context, p map[string]string) (*ActionResult, error) {
	return v.next.Execute(ctx, p)
}

// Unknown type, no audit row: the failure is reported before anything is
// written, so the executor cannot leave a phantom execution behind.
func TestExecuteActionRejectsUnknownTypeWithoutRecording(t *testing.T) {
	mock, repo := newMockRepo(t)
	expectNoPersistedActions(mock, "tenant-a")
	exec := newTestExecutor(repo)

	if _, err := exec.ExecuteAction(context.Background(), "tenant-a", "no_such_type", nil); !errors.Is(err, ErrHandlerNotFound) {
		t.Fatalf("err = %v, want ErrHandlerNotFound", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("an unexpected statement was issued for an unknown type: %v", err)
	}
}
