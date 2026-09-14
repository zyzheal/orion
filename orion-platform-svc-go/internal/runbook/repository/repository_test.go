package repository

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/runbook/models"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

// The matcher compares statements after collapsing whitespace, so an
// expectation written against a full "SELECT ... FROM runbooks WHERE ..."
// statement cannot quietly satisfy a statement that only says
// "WHERE tenant_id = $1 ORDER BY ...". That is the defect under test here.
var ws = regexp.MustCompile(`\s+`)

func normSQL(s string) string {
	return strings.TrimSpace(ws.ReplaceAllString(s, " "))
}

// mockDB returns a repository database whose matcher rejects any statement
// that is not byte-identical to the expectation once whitespace is collapsed.
func mockDB(t *testing.T) (*sqlx.DB, sqlmock.Sqlmock) {
	t.Helper()
	raw, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherFunc(func(expected, actual string) error {
		if normSQL(expected) != normSQL(actual) {
			return fmt.Errorf("sql mismatch: want %q got %q", expected, actual)
		}
		return nil
	})))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = raw.Close() })
	return sqlx.NewDb(raw, "postgres"), mock
}

// listColumns is a hand-transcribed copy of the SELECT list the repository
// emits. Writing it out instead of referencing runbookColumns keeps this test
// able to fail when the repository's column list drifts.
const listColumns = "SELECT id, tenant_id, title, description, category, severity, steps, " +
	"tags, owner, approved, enabled, created_at, updated_at"

var rowNames = []string{
	"id", "tenant_id", "title", "description", "category", "severity",
	"steps", "tags", "owner", "approved", "enabled", "created_at", "updated_at",
}

func oneRunbookRow(t *testing.T, steps, tags string) *sqlmock.Rows {
	t.Helper()
	now := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	return sqlmock.NewRows(rowNames).AddRow(
		"rb-1", "t-1", "Postgres restore", "Restore guide", "database", "high",
		steps, tags, "alice", true, true, now, now)
}

const oneStep = `[{"order":1,"title":"Restore","command":"pg_restore","expected_output":"OK","automated":true}]`
const twoTags = `["database","critical"]`

// TestListBuildsASelectableStatement pins the defect that made GET /runbooks
// dead: the item query used to be cond+" ORDER BY created_at DESC LIMIT $n
// OFFSET $m" where cond starts with "WHERE", which sent
//
//	WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3
//
// to Postgres -- no SELECT, no FROM -- a syntax error on every call. The
// COUNT query directly above it was already well formed, which is why the bug
// survived: the total came back and the rows never did.
func TestListBuildsASelectableStatement(t *testing.T) {
	// The matcher records every statement it is asked to check, so the test
	// asserts on the real text the repository handed to the driver, not only
	// on whether sqlmock accepted it.
	var seen []string
	raw, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherFunc(func(expected, actual string) error {
		seen = append(seen, normSQL(actual))
		if normSQL(expected) != normSQL(actual) {
			return fmt.Errorf("sql mismatch: want %q got %q", expected, actual)
		}
		return nil
	})))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = raw.Close() })
	db := sqlx.NewDb(raw, "postgres")
	repo := NewRepository(db)

	mock.ExpectQuery(normSQL("SELECT COUNT(*) FROM runbooks WHERE tenant_id = $1")).
		WithArgs("t-1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
	mock.ExpectQuery(normSQL(listColumns+" FROM runbooks WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3")).
		WithArgs("t-1", int64(20), int64(0)).
		WillReturnRows(oneRunbookRow(t, oneStep, `["database"]`))

	items, total, err := repo.List(context.Background(), "t-1", models.ListQuery{})
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if total != 1 || len(items) != 1 {
		t.Fatalf("total=%d items=%d, want 1/1", total, len(items))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("List did not issue the expected statements: %v", err)
	}
	if len(seen) < 2 {
		t.Fatalf("the item query was never sent to the database")
	}
	stmt := seen[len(seen)-1]
	if !strings.HasPrefix(stmt, "SELECT ") {
		t.Fatalf("the item query does not start with SELECT: %s", stmt)
	}
	if !strings.Contains(stmt, "FROM runbooks WHERE") {
		t.Fatalf("the item query has no FROM clause: %s", stmt)
	}
}

func TestListFiltersNumberPlaceholders(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	limit, offset := 5, 10
	approved := false
	q := models.ListQuery{Limit: &limit, Offset: &offset, Category: "database", Severity: "critical", Approved: &approved}

	mock.ExpectQuery(normSQL("SELECT COUNT(*) FROM runbooks WHERE tenant_id = $1 AND category = $2 AND severity = $3 AND approved = $4")).
		WithArgs("t-1", "database", "critical", false).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectQuery(normSQL(listColumns+" FROM runbooks WHERE tenant_id = $1 AND category = $2 AND severity = $3 AND approved = $4 ORDER BY created_at DESC LIMIT $5 OFFSET $6")).
		WithArgs("t-1", "database", "critical", false, int64(5), int64(10)).
		WillReturnRows(sqlmock.NewRows(rowNames))

	items, total, err := repo.List(context.Background(), "t-1", q)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if total != 0 || len(items) != 0 {
		t.Fatalf("total=%d items=%d, want 0/0 for an empty page", total, len(items))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("filter placeholders were not numbered correctly: %v", err)
	}
}

func TestListReturnsAStatementFailure(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)
	fail := errors.New("deadlock detected")

	mock.ExpectQuery(normSQL("SELECT COUNT(*) FROM runbooks WHERE tenant_id = $1")).
		WithArgs("t-1").WillReturnError(fail)

	items, total, err := repo.List(context.Background(), "t-1", models.ListQuery{})
	if !errors.Is(err, fail) {
		t.Fatalf("error %q is not the statement failure", err)
	}
	if err != nil && (items != nil || total != 0) {
		t.Fatalf("a failed count must return no rows, got %d items and total %d", len(items), total)
	}
}

func TestGetByIDUsesAnExplicitColumnListAndDecodesJSON(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectQuery(normSQL(listColumns+" FROM runbooks WHERE id = $1 AND tenant_id = $2")).
		WithArgs("rb-1", "t-1").
		WillReturnRows(oneRunbookRow(t, oneStep, twoTags))

	got, err := repo.GetByID(context.Background(), "t-1", "rb-1")
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if got.Title != "Postgres restore" || got.Owner != "alice" || !got.Approved || !got.Enabled {
		t.Fatalf("unexpected row: %+v", got)
	}
	if len(got.Steps) != 1 || got.Steps[0].Command != "pg_restore" || got.Steps[0].Order != 1 || !got.Steps[0].Automated {
		t.Fatalf("steps were not decoded: %+v", got.Steps)
	}
	if len(got.Tags) != 2 || got.Tags[0] != "database" {
		t.Fatalf("tags were not decoded: %+v", got.Tags)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("GetByID did not issue the expected statement: %v", err)
	}
}

func TestUpdateWritesEveryRequestedColumn(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	// Whitelist order is title, description, category, severity, steps, tags,
	// owner, approved, enabled, so the request below binds title to $1 through
	// enabled to $9 no matter how the service filled the map.
	mock.ExpectExec(normSQL(`UPDATE runbooks SET title = $1, description = $2, category = $3, severity = $4, steps = $5, tags = $6, owner = $7, approved = $8, enabled = $9, updated_at = NOW() WHERE id = $10 AND tenant_id = $11`)).
		WithArgs("Postgres restore v2", "Rewritten", "database", "critical", oneStep, twoTags,
			"alice", true, true, "rb-1", "t-1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery(normSQL(listColumns+" FROM runbooks WHERE id = $1 AND tenant_id = $2")).
		WithArgs("rb-1", "t-1").
		WillReturnRows(oneRunbookRow(t, "[]", "[]"))

	got, err := repo.Update(context.Background(), "t-1", "rb-1", map[string]interface{}{
		"enabled":     true,
		"approved":    true,
		"owner":       "alice",
		"tags":        []string{"database", "critical"},
		"steps":       []models.RunbookStep{{Order: 1, Title: "Restore", Command: "pg_restore", ExpectedOutput: "OK", Automated: true}},
		"severity":    "critical",
		"category":    "database",
		"description": "Rewritten",
		"title":       "Postgres restore v2",
	})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if got == nil || got.ID != "rb-1" {
		t.Fatalf("Update did not return the stored row: %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the update did not reach the database: %v", err)
	}
}

func TestUpdateRejectsAColumnItWillNotWrite(t *testing.T) {
	db, _ := mockDB(t)
	repo := NewRepository(db)

	got, err := repo.Update(context.Background(), "t-1", "rb-1", map[string]interface{}{
		"tenant_id": "other-tenant",
	})
	if err == nil {
		t.Fatal("an unknown column must not be silently dropped")
	}
	if got != nil {
		t.Fatalf("a rejected update must not return a row: %+v", got)
	}
	// A "no expectation" error from sqlmock would satisfy err != nil and leave
	// the guard untested, so pin the message the guard itself produces.
	if !strings.Contains(err.Error(), `column "tenant_id" is not updatable`) {
		t.Fatalf("error %q does not name the rejected column", err.Error())
	}
}

// An empty update is not an update: it must come back as the existing row, and
// it must not issue an UPDATE with an empty SET clause.
func TestUpdateWithNoColumnsReturnsTheExistingRow(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectQuery(normSQL(listColumns+" FROM runbooks WHERE id = $1 AND tenant_id = $2")).
		WithArgs("rb-1", "t-1").
		WillReturnRows(oneRunbookRow(t, "[]", "[]"))

	got, err := repo.Update(context.Background(), "t-1", "rb-1", map[string]interface{}{})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if got == nil || got.ID != "rb-1" {
		t.Fatalf("Update with no columns must return the existing row, got %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("an empty update must not issue an UPDATE: %v", err)
	}
}

func TestUpdateReturnsAStatementFailure(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)
	fail := errors.New("deadlock detected")

	mock.ExpectExec(normSQL(`UPDATE runbooks SET title = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`)).
		WithArgs("nope", "rb-1", "t-1").WillReturnError(fail)

	got, err := repo.Update(context.Background(), "t-1", "rb-1", map[string]interface{}{"title": "nope"})
	if !errors.Is(err, fail) {
		t.Fatalf("error %q is not the statement failure", err)
	}
	if err != nil && got != nil {
		t.Fatalf("a failed update must not return a row: %+v", got)
	}
}

func TestCreateBindsEveryColumn(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectExec(normSQL(`INSERT INTO runbooks (id, tenant_id, title, description, category, severity, steps, tags, owner, approved, enabled, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`)).
		WithArgs(sqlmock.AnyArg(), "t-1", "Postgres restore", "Restore guide", "database", "high",
			oneStep, `["database"]`, "alice", false, true, sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	m := &models.Runbook{
		Title: "Postgres restore", Description: "Restore guide",
		Category: "database", Severity: "high",
		Steps: []models.RunbookStep{{Order: 1, Title: "Restore", Command: "pg_restore", ExpectedOutput: "OK", Automated: true}},
		Tags:  []string{"database"}, Owner: "alice", Enabled: true,
	}
	if err := repo.Create(context.Background(), "t-1", m); err != nil {
		t.Fatalf("Create: %v", err)
	}
	if m.ID == "" || m.TenantID != "t-1" || m.CreatedAt.IsZero() {
		t.Fatalf("Create did not populate the new row: %+v", m)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the insert did not reach the database: %v", err)
	}
}

func TestCreateExecutionBindsEveryColumn(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectExec(normSQL(`INSERT INTO runbook_executions (id, tenant_id, runbook_id, incident_id, executor_id, status, started_at, completed_at, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`)).
		WithArgs(sqlmock.AnyArg(), "t-1", "rb-1", "inc-1", "alice", "running",
			sqlmock.AnyArg(), nil, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	ex := &models.RunbookExecution{RunbookID: "rb-1", IncidentID: "inc-1", ExecutorID: "alice", Status: "running"}
	if err := repo.CreateExecution(context.Background(), "t-1", ex); err != nil {
		t.Fatalf("CreateExecution: %v", err)
	}
	if ex.ID == "" || ex.StartedAt.IsZero() || !ex.CreatedAt.Equal(ex.StartedAt) {
		t.Fatalf("CreateExecution did not populate the new row: %+v", ex)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the insert did not reach the database: %v", err)
	}
}

// Execution history is child data: deleting a runbook must remove its steps,
// its executions and the runbook itself, and the three must commit together.
func TestDeleteRemovesExecutionHistoryInOneTransaction(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectBegin()
	mock.ExpectExec(normSQL(`DELETE FROM runbook_execution_steps WHERE execution_id IN (SELECT id FROM runbook_executions WHERE runbook_id = $1)`)).
		WithArgs("rb-1").WillReturnResult(sqlmock.NewResult(0, 3))
	mock.ExpectExec(normSQL(`DELETE FROM runbook_executions WHERE runbook_id = $1`)).
		WithArgs("rb-1").WillReturnResult(sqlmock.NewResult(0, 2))
	mock.ExpectExec(normSQL(`DELETE FROM runbooks WHERE id = $1 AND tenant_id = $2`)).
		WithArgs("rb-1", "t-1").WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	if err := repo.Delete(context.Background(), "t-1", "rb-1"); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("Delete did not remove the execution history: %v", err)
	}
}

func TestListExecutionsUsesAnExplicitColumnList(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	now := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	mock.ExpectQuery(normSQL(`SELECT id, tenant_id, runbook_id, incident_id, executor_id, status, started_at, completed_at, created_at FROM runbook_executions WHERE tenant_id = $1 AND runbook_id = $2 ORDER BY started_at DESC LIMIT $3`)).
		WithArgs("t-1", "rb-1", int64(50)).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "runbook_id", "incident_id", "executor_id", "status", "started_at", "completed_at", "created_at"}).
			AddRow("ex-1", "t-1", "rb-1", "inc-1", "alice", "completed", now, nil, now))

	items, err := repo.ListExecutions(context.Background(), "t-1", "rb-1", 50)
	if err != nil {
		t.Fatalf("ListExecutions: %v", err)
	}
	if len(items) != 1 || items[0].ID != "ex-1" || items[0].Status != "completed" {
		t.Fatalf("unexpected rows: %+v", items)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("ListExecutions did not issue the expected statement: %v", err)
	}
}

func TestUpdateExecutionStatusSetsCompletedAt(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectExec(normSQL(`UPDATE runbook_executions SET status = $1, completed_at = $2 WHERE id = $3 AND tenant_id = $4`)).
		WithArgs("completed", sqlmock.AnyArg(), "ex-1", "t-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := repo.UpdateExecutionStatus(context.Background(), "t-1", "ex-1", "completed"); err != nil {
		t.Fatalf("UpdateExecutionStatus: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the status update did not reach the database: %v", err)
	}
}

func TestBuildRunbookSETIsNumberedAndInWhitelistOrder(t *testing.T) {
	clause, args, err := buildRunbookSET(map[string]interface{}{
		"approved": true,
		"severity": "low",
		"title":    "v3",
	})
	if err != nil {
		t.Fatalf("buildRunbookSET: %v", err)
	}
	if clause != "title = $1, severity = $2, approved = $3" {
		t.Fatalf("unexpected SET clause %q", clause)
	}
	if len(args) != 3 || args[0] != "v3" || args[1] != "low" || args[2] != true {
		t.Fatalf("unexpected args %v", args)
	}

	clause, args, err = buildRunbookSET(map[string]interface{}{
		"steps": []models.RunbookStep{{Order: 1, Command: "echo hi"}},
		"tags":  []string{"a"},
	})
	if err != nil {
		t.Fatalf("buildRunbookSET: %v", err)
	}
	if clause != "steps = $1, tags = $2" {
		t.Fatalf("unexpected SET clause %q", clause)
	}
	if args[0] != `[{"order":1,"title":"","command":"echo hi","expected_output":"","automated":false}]` {
		t.Fatalf("steps were not encoded as JSON, got %v", args[0])
	}
	if args[1] != `["a"]` {
		t.Fatalf("tags were not encoded as JSON, got %v", args[1])
	}

	if clause, args, _ = buildRunbookSET(map[string]interface{}{}); clause != "" || len(args) != 0 {
		t.Fatalf("an empty update must produce an empty clause, got %q %v", clause, args)
	}
}
