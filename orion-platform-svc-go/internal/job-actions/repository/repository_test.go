package repository

import (
	"context"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"

	"orion/platform-svc-go/internal/job-actions/models"
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
	mock.ExpectQuery(`SELECT id, tenant_id, name, type, description, params, category, timeout, retry_count, enabled, created_at, updated_at FROM job_actions WHERE id=\$1 AND tenant_id=\$2`).WillReturnRows(jobActionRow())

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
	mock.ExpectQuery(`SELECT id, tenant_id, name, type, description, params, category, timeout, retry_count, enabled, created_at, updated_at FROM job_actions WHERE id=\$1 AND tenant_id=\$2`).WillReturnRows(jobActionRow())

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
		"e-1", "tenant-a", "a-1", "{}", models.StatusCompleted, "pods restarted", "",
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
		"status":      models.StatusCompleted,
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

// ListHistory used to take no tenant id at all, so a request from tenant B for
// an action id that belongs to tenant A returned A's execution history. The
// count and the page must both carry the tenant predicate.
func TestListHistoryBindsTheTenant(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM job_action_executions WHERE tenant_id=\$1 AND action_id=\$2`).
		WithArgs("tenant-a", "a-1").
		WillReturnRows(sqlmock.NewRows([]string{"COUNT(*)"}).AddRow(1))
	mock.ExpectQuery(`SELECT id, tenant_id, action_id, params, status, output, error, duration_ms, started_at, finished_at, created_at FROM job_action_executions WHERE tenant_id=\$1 AND action_id=\$2 ORDER BY started_at DESC LIMIT \$3 OFFSET \$4`).
		WithArgs("tenant-a", "a-1", sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnRows(executionRow())

	resp, err := repo.ListHistory(context.Background(), "tenant-a", "a-1", 10, 0)
	if err != nil {
		t.Fatalf("ListHistory: %v", err)
	}
	if resp.Total != 1 || len(resp.Data) != 1 {
		t.Fatalf("ListHistory = total %d, %d rows, want 1 and 1", resp.Total, len(resp.Data))
	}
	if resp.Data[0].TenantID != "tenant-a" {
		t.Fatalf("history row tenant = %q, want tenant-a", resp.Data[0].TenantID)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the tenant predicate was not bound on every read: %v", err)
	}
}

// ListHistory caps the page so a caller cannot request an unbounded response.
func TestListHistoryClampsTheLimit(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM job_action_executions WHERE tenant_id=\$1 AND action_id=\$2`).
		WillReturnRows(sqlmock.NewRows([]string{"COUNT(*)"}).AddRow(0))
	// Pin the exact clamped values rather than AnyArg: an AnyArg here would make
	// this test pass whether or not ListHistory clamps at all, because the
	// placeholder positions survive the change.
	mock.ExpectQuery(`LIMIT \$3 OFFSET \$4`).
		WithArgs("tenant-a", "a-1", 100, 0).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "action_id", "params", "status", "output", "error",
			"duration_ms", "started_at", "finished_at", "created_at",
		}))

	if _, err := repo.ListHistory(context.Background(), "tenant-a", "a-1", 99999, 0); err != nil {
		t.Fatalf("ListHistory: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the limit was not applied to the read: %v", err)
	}
}

// Every SELECT in this package must name its columns. go-common opens the pool
// through sqlx.Open and never calls Unsafe, so sqlx scans in safe mode and a
// wildcard select dies on the first row the moment a migration adds a column
// the models do not declare -- "missing destination name <col>". That error is
// not sql.ErrNoRows, so it walks repository -> service -> handler and answers
// 500 instead of data. This test pins the package against that regression.
func TestNoWildcardSelectInTheRepository(t *testing.T) {
	files, err := filepath.Glob("*.go")
	if err != nil {
		t.Fatalf("glob: %v", err)
	}
	scanned := 0
	for _, name := range files {
		if strings.HasSuffix(name, "_test.go") {
			continue
		}
		scanned++
		src, rerr := os.ReadFile(name)
		if rerr != nil {
			t.Fatalf("read %s: %v", name, rerr)
		}
		if strings.Contains(string(src), "SELECT *") {
			t.Errorf("%s contains a wildcard SELECT", name)
		}
	}
	if scanned == 0 {
		t.Fatal("no non-test Go file found in the repository package")
	}
}

// The two column constants must exist and must name exactly the columns the
// models declare. A column short of one breaks GetAction / GetExecution in
// sqlx safe mode; a column one too many means the constant is out of step with
// the models.
func TestColumnConstantsMatchTheModels(t *testing.T) {
	src, err := os.ReadFile("repository.go")
	if err != nil {
		t.Fatalf("read repository: %v", err)
	}
	for _, tc := range []struct {
		constName string
		wantCols  int
	}{
		{"actionColumns", 12},
		{"executionColumns", 11},
	} {
		re := regexp.MustCompile(`\b` + tc.constName + `\s*=\s*"([^"]*)"`)
		m := re.FindStringSubmatch(string(src))
		if m == nil {
			t.Fatalf("repository.go does not declare a %s constant", tc.constName)
		}
		cols := 0
		for _, c := range strings.Split(m[1], ",") {
			if strings.TrimSpace(c) != "" {
				cols++
			}
		}
		if cols != tc.wantCols {
			t.Errorf("%s names %d columns, want %d: %s", tc.constName, cols, tc.wantCols, m[1])
		}
	}
}
