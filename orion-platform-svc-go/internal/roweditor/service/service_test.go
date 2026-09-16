package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
	"orion/platform-svc-go/internal/roweditor"
	"orion/platform-svc-go/internal/roweditor/handler/models"
	"orion/platform-svc-go/internal/roweditor/repository"
)

// --- fake DB -------------------------------------------------------------

type stmtRecord struct {
	sql  string
	args []any
}

// fakeDB records every statement the editor issues and lets a test drive the
// RowsAffected result. It is deliberately stricter than the mock in the parent
// package: it checks that the number of bound arguments matches the number of
// $N placeholders in the statement, because that comparison is what caught the
// SET/WHERE placeholder collision.
type fakeDB struct {
	mu       sync.Mutex
	stmts    []stmtRecord
	affected int64
	failGet  bool // SelectRowMap fails, driving the read-failure path
}

func (f *fakeDB) record(sqlText string, args []any) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.stmts = append(f.stmts, stmtRecord{sql: sqlText, args: append([]any(nil), args...)})
}

func (f *fakeDB) ExecContext(_ context.Context, query string, args ...any) (sql.Result, error) {
	f.record(query, args)
	return fakeResult{affected: f.affected}, nil
}

func (f *fakeDB) NamedExecContext(_ context.Context, query string, arg any) (sql.Result, error) {
	f.record(query, []any{arg})
	return fakeResult{affected: f.affected}, nil
}

func (f *fakeDB) SelectRowMap(_ context.Context, query string, args ...any) (roweditor.Row, error) {
	f.record(query, args)
	if f.failGet {
		return nil, errors.New("get failed")
	}
	return roweditor.Row{"id": "r1"}, nil
}

func (f *fakeDB) BeginTxx(context.Context, *sql.TxOptions) (roweditor.TxOperations, error) {
	return f, nil
}

func (f *fakeDB) Commit() error   { return nil }
func (f *fakeDB) Rollback() error { return nil }

func (f *fakeDB) statements() []stmtRecord {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]stmtRecord, len(f.stmts))
	copy(out, f.stmts)
	return out
}

type fakeResult struct{ affected int64 }

func (r fakeResult) LastInsertId() (int64, error) { return 0, sql.ErrNoRows }
func (r fakeResult) RowsAffected() (int64, error) { return r.affected, nil }

// boundColumn reports which column owns placeholder $n in a statement. It is
// how a test proves the tenant argument landed in the tenant predicate rather
// than in the SET clause.
func boundColumn(sqlText string, n int) string {
	re := regexp.MustCompile(`([A-Za-z_][A-Za-z0-9_]*)=\$(\d+)`)
	for _, m := range re.FindAllStringSubmatch(sqlText, -1) {
		if m[2] == strconv.Itoa(n) {
			return m[1]
		}
	}
	return ""
}

// tenantPlaceholder returns the index of the argument bound to tenant_id, or -1.
func tenantPlaceholder(rec stmtRecord) int {
	for i, a := range rec.args {
		if a == "t1" {
			if col := boundColumn(rec.sql, i+1); col == "tenant_id" {
				return i
			}
		}
	}
	return -1
}

// --- fixtures ------------------------------------------------------------

func itemsSpec() roweditor.RowSpec {
	return roweditor.RowSpec{
		TableName:     "items",
		PrimaryKey:    "id",
		VersionColumn: "version",
		Columns: []roweditor.ColumnSpec{
			{Name: "id"}, {Name: "name"}, {Name: "version"},
		},
	}
}

func reqColumns() []models.ColumnSpec {
	return []models.ColumnSpec{{Name: "id"}, {Name: "name"}}
}

func expectSave(t *testing.T, mock sqlmock.Sqlmock, tenant, name string) {
	t.Helper()
	mock.ExpectExec(`INSERT INTO row_editor (id, tenant_id, key, value, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW()) ON CONFLICT (tenant_id, key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`).
		WithArgs(sqlmock.AnyArg(), tenant, name, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))
}

func newRepo(t *testing.T) (*repository.Repository, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherFunc(func(expected, actual string) error {
		normalize := func(s string) string {
			return strings.TrimSpace(regexp.MustCompile(`\s+`).ReplaceAllString(s, " "))
		}
		if normalize(expected) == normalize(actual) {
			return nil
		}
		return errors.New("sql mismatch: expected " + normalize(expected) + " got " + normalize(actual))
	})))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return repository.NewRepository(sqlx.NewDb(db, "postgres")), mock
}

func jsonMarshal(t *testing.T, v any) (string, error) {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func editorRow(t *testing.T, mock sqlmock.Sqlmock, tenant, name string, spec roweditor.RowSpec) {
	t.Helper()
	b, err := jsonMarshal(t, spec)
	if err != nil {
		t.Fatalf("spec not marshalable: %v", err)
	}
	mock.ExpectQuery(`SELECT * FROM row_editor WHERE tenant_id=$1 AND key=$2`).
		WithArgs(tenant, name).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "key", "value", "created_at", "updated_at"}).
			AddRow("33333333-3333-3333-3333-333333333333", tenant, name, string(b), time.Now(), time.Now()))
}

// --- tests ---------------------------------------------------------------

func TestUpdateRowUsesCallerTenant(t *testing.T) {
	svc := NewService(nil)
	if err := svc.RegisterEditor(context.Background(), "t1", "items", &models.RowEditorSpecRequest{
		TableName: "items", PrimaryKey: "id", VersionColumn: "version", Columns: reqColumns(),
	}); err != nil {
		t.Fatalf("RegisterEditor() error = %v", err)
	}
	db := &fakeDB{affected: 1}

	// "abc" is shorter than 8 characters. The service used to derive the tenant
	// from req.RowID[:8], which panicked here and otherwise attributed the edit
	// to a value taken from the primary key.
	resp, err := svc.UpdateRow(context.Background(), "t1", "items", db, &models.RowUpdateRequest{
		RowID: "abc", Changes: map[string]any{"name": "new"}, Version: 3,
	})
	if err != nil {
		t.Fatalf("UpdateRow() error = %v", err)
	}
	if resp.Affected != 1 {
		t.Fatalf("UpdateRow() affected = %d, want 1", resp.Affected)
	}
	recs := db.statements()
	if len(recs) != 1 {
		t.Fatalf("expected 1 statement, got %d", len(recs))
	}
	rec := recs[0]
	if !strings.Contains(rec.sql, "tenant_id=") {
		t.Fatalf("update must carry a tenant predicate: %s", rec.sql)
	}
	if i := tenantPlaceholder(rec); i < 0 {
		t.Fatalf("tenant t1 is not bound to the tenant predicate\n  sql:  %s\n  args: %v", rec.sql, rec.args)
	}
	if col := boundColumn(rec.sql, 1); col != "name" {
		t.Fatalf("placeholder $1 belongs to %q, want name: %s", col, rec.sql)
	}
	if col := boundColumn(rec.sql, 2); col != "id" {
		t.Fatalf("placeholder $2 belongs to %q, want id (the row id): %s", col, rec.sql)
	}
	if rec.args[1] != "abc" {
		t.Fatalf("row id arg = %v, want abc", rec.args[1])
	}
}

func TestBatchUpdateUsesCallerTenant(t *testing.T) {
	svc := NewService(nil)
	if err := svc.RegisterEditor(context.Background(), "t1", "items", &models.RowEditorSpecRequest{
		TableName: "items", PrimaryKey: "id", VersionColumn: "version", Columns: reqColumns(),
	}); err != nil {
		t.Fatalf("RegisterEditor() error = %v", err)
	}
	db := &fakeDB{affected: 1}

	_, err := svc.BatchUpdate(context.Background(), "t1", "items", db, &models.BatchUpdateRequest{
		RowIDs: []string{"r1", "r2"}, Changes: map[string]any{"name": "bulk"}, Version: 1,
	})
	if err != nil {
		t.Fatalf("BatchUpdate() error = %v", err)
	}
	recs := db.statements()
	if len(recs) != 2 {
		t.Fatalf("expected 2 statements, got %d", len(recs))
	}
	for i, rec := range recs {
		if tenantPlaceholder(rec) < 0 {
			t.Fatalf("batch statement %d is not tenant scoped\n  sql:  %s\n  args: %v", i, rec.sql, rec.args)
		}
	}
}

func TestCreateRowIgnoresBodyTenant(t *testing.T) {
	svc := NewService(nil)
	if err := svc.RegisterEditor(context.Background(), "t1", "items", &models.RowEditorSpecRequest{
		TableName: "items", PrimaryKey: "id", Columns: reqColumns(),
	}); err != nil {
		t.Fatalf("RegisterEditor() error = %v", err)
	}
	db := &fakeDB{affected: 1}

	// The body carries its own tenant_id. The handler no longer reads one, and
	// the editor replaces whatever the row map says with the caller's tenant.
	_, err := svc.CreateRow(context.Background(), "t1", "items", db, &models.RowCreateRequest{
		Row: map[string]any{"id": "r1", "name": "n", "tenant_id": "attacker"},
	})
	if err != nil {
		t.Fatalf("CreateRow() error = %v", err)
	}
	args, ok := db.statements()[0].args[0].(map[string]any)
	if !ok {
		t.Fatalf("insert arg is %T", db.statements()[0].args[0])
	}
	if args["tenant_id"] != "t1" {
		t.Fatalf("insert tenant = %v, want t1", args["tenant_id"])
	}
}

func TestBatchCreateIgnoresBodyTenant(t *testing.T) {
	svc := NewService(nil)
	if err := svc.RegisterEditor(context.Background(), "t1", "items", &models.RowEditorSpecRequest{
		TableName: "items", PrimaryKey: "id", Columns: reqColumns(),
	}); err != nil {
		t.Fatalf("RegisterEditor() error = %v", err)
	}
	db := &fakeDB{affected: 1}

	resp, err := svc.BatchCreate(context.Background(), "t1", "items", db, &models.BatchCreateRequest{
		Rows: []map[string]any{
			{"id": "r1", "name": "a", "tenant_id": "attacker"},
			{"id": "r2", "name": "b"},
		},
	})
	if err != nil {
		t.Fatalf("BatchCreate() error = %v", err)
	}
	if resp.Affected != 2 {
		t.Fatalf("BatchCreate() affected = %d, want 2", resp.Affected)
	}
	for i, rec := range db.statements() {
		args, ok := rec.args[0].(map[string]any)
		if !ok {
			t.Fatalf("insert %d arg is %T", i, rec.args[0])
		}
		if args["tenant_id"] != "t1" {
			t.Fatalf("insert %d tenant = %v, want t1", i, args["tenant_id"])
		}
	}
}

func TestEditorCacheIsTenantScoped(t *testing.T) {
	svc := NewService(nil)
	for _, tenant := range []string{"tenant-a", "tenant-b"} {
		table := "table_" + tenant[len("tenant-"):]
		if err := svc.RegisterEditor(context.Background(), tenant, "users", &models.RowEditorSpecRequest{
			TableName: table, PrimaryKey: "id", Columns: reqColumns(),
		}); err != nil {
			t.Fatalf("RegisterEditor(%s) error = %v", tenant, err)
		}
	}

	// The cache key used to be the editor name alone, so the second registration
	// replaced the first tenant's editor for the whole process.
	for _, tenant := range []string{"tenant-a", "tenant-b"} {
		ed, err := svc.GetEditor(context.Background(), tenant, "users")
		if err != nil {
			t.Fatalf("GetEditor(%s) error = %v", tenant, err)
		}
		want := "table_" + tenant[len("tenant-"):]
		if ed.Spec().TableName != want {
			t.Fatalf("GetEditor(%s) table = %q, want %q", tenant, ed.Spec().TableName, want)
		}
	}
}

func TestGetEditorLoadsFromRepository(t *testing.T) {
	repo, mock := newRepo(t)
	editorRow(t, mock, "t1", "items", itemsSpec())
	svc := NewService(repo)

	ed, err := svc.GetEditor(context.Background(), "t1", "items")
	if err != nil {
		t.Fatalf("GetEditor() error = %v", err)
	}
	if ed.Spec().TableName != "items" {
		t.Fatalf("GetEditor() table = %q, want items", ed.Spec().TableName)
	}
	// The second lookup must come from the cache, not from the database.
	if _, err := svc.GetEditor(context.Background(), "t1", "items"); err != nil {
		t.Fatalf("cached GetEditor() error = %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestGetEditorReturnsNotFoundWithoutCache(t *testing.T) {
	svc := NewService(nil)
	_, err := svc.GetEditor(context.Background(), "t1", "ghost")
	if !errors.Is(err, roweditor.ErrEditorNotFound) {
		t.Fatalf("GetEditor() error = %v, want ErrEditorNotFound", err)
	}
}

func TestGetEditorReturnsNotFoundWhenRepositoryHasNoRow(t *testing.T) {
	repo, mock := newRepo(t)
	mock.ExpectQuery(`SELECT * FROM row_editor WHERE tenant_id=$1 AND key=$2`).
		WithArgs("t1", "ghost").
		WillReturnError(sql.ErrNoRows)
	svc := NewService(repo)

	_, err := svc.GetEditor(context.Background(), "t1", "ghost")
	if !errors.Is(err, roweditor.ErrEditorNotFound) {
		t.Fatalf("GetEditor() error = %v, want ErrEditorNotFound", err)
	}
}

func TestDeleteRowHonoursSpecSoftDelete(t *testing.T) {
	cases := []struct {
		soft     bool
		wantKind string
	}{
		{true, "UPDATE"},
		{false, "DELETE"},
	}
	for _, tc := range cases {
		t.Run(tc.wantKind, func(t *testing.T) {
			svc := NewService(nil)
			if err := svc.RegisterEditor(context.Background(), "t1", "items", &models.RowEditorSpecRequest{
				TableName: "items", PrimaryKey: "id", SoftDelete: tc.soft, Columns: reqColumns(),
			}); err != nil {
				t.Fatalf("RegisterEditor() error = %v", err)
			}
			db := &fakeDB{affected: 1}

			_, err := svc.DeleteRow(context.Background(), "t1", "items", db, "r1")
			if err != nil {
				t.Fatalf("DeleteRow() error = %v", err)
			}
			sqlText := db.statements()[0].sql
			if !strings.HasPrefix(sqlText, tc.wantKind) {
				t.Fatalf("softDelete=%v issued %q", tc.soft, sqlText)
			}
			if tenantPlaceholder(db.statements()[0]) < 0 {
				t.Fatalf("delete is not tenant scoped\n  sql:  %s\n  args: %v", sqlText, db.statements()[0].args)
			}
		})
	}
}

func TestRequiredSurvivesRestart(t *testing.T) {
	// Tenant registers an editor with a required column.
	repo, mock := newRepo(t)
	expectSave(t, mock, "t1", "items")
	before := NewService(repo)
	if err := before.RegisterEditor(context.Background(), "t1", "items", &models.RowEditorSpecRequest{
		TableName: "items", PrimaryKey: "id",
		Columns: []models.ColumnSpec{{Name: "id"}, {Name: "name", IsRequired: true}},
	}); err != nil {
		t.Fatalf("RegisterEditor() error = %v", err)
	}

	// The process restarts: the cache is empty and the spec comes back from the
	// database. The required rule must still be enforced, which it was not —
	// the validator lived only in memory and did not cross the JSON boundary.
	editorRow(t, mock, "t1", "items", roweditor.RowSpec{
		TableName:  "items",
		PrimaryKey: "id",
		Columns:    []roweditor.ColumnSpec{{Name: "id"}, {Name: "name", Required: true}},
	})
	after := NewService(repo)
	ed, err := after.GetEditor(context.Background(), "t1", "items")
	if err != nil {
		t.Fatalf("GetEditor() error = %v", err)
	}
	if !ed.Spec().Columns[1].Required {
		t.Fatalf("loaded spec lost the required flag: %+v", ed.Spec().Columns)
	}
	db := &fakeDB{affected: 1}
	_, err = after.CreateRow(context.Background(), "t1", "items", db, &models.RowCreateRequest{
		Row: map[string]any{"id": "r1"},
	})
	if !errors.Is(err, roweditor.ErrValidationError) {
		t.Fatalf("CreateRow() error = %v, want ErrValidationError for a missing required column", err)
	}
	if len(db.statements()) != 0 {
		t.Fatalf("a rejected create must not reach the database, got %d statements", len(db.statements()))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestReadRowBindsTenantAndReturnsTheRow(t *testing.T) {
	svc := NewService(nil)
	if err := svc.RegisterEditor(context.Background(), "t1", "items", &models.RowEditorSpecRequest{
		TableName: "items", PrimaryKey: "id", Columns: reqColumns(),
	}); err != nil {
		t.Fatalf("RegisterEditor() error = %v", err)
	}
	db := &fakeDB{affected: 1}

	resp, err := svc.ReadRow(context.Background(), "t1", "items", db, "r1")
	if err != nil {
		t.Fatalf("ReadRow() error = %v", err)
	}
	recs := db.statements()
	if len(recs) != 1 {
		t.Fatalf("expected 1 statement, got %d", len(recs))
	}
	wantSQL := "SELECT * FROM items WHERE id=$1 AND tenant_id=$2 AND status!='deleted'"
	if recs[0].sql != wantSQL {
		t.Fatalf("select SQL = %q, want %q", recs[0].sql, wantSQL)
	}
	// The query binds tenant_id only when the tenant is non-empty, so the
	// argument list must have exactly two entries. Passing the empty string
	// anyway sent an argument to a placeholder that does not exist.
	if len(recs[0].args) != 2 || recs[0].args[0] != "r1" || recs[0].args[1] != "t1" {
		t.Fatalf("select args = %v, want [r1 t1]", recs[0].args)
	}
	if resp.NewRow["id"] != "r1" {
		t.Fatalf("ReadRow() did not return the row: %+v", resp.NewRow)
	}
}

func TestReadRowWithoutTenantBindsOnePlaceholder(t *testing.T) {
	ed, err := roweditor.NewRowEditor(itemsSpec())
	if err != nil {
		t.Fatalf("NewRowEditor() error = %v", err)
	}
	db := &fakeDB{affected: 1}

	if _, err := ed.Read(context.Background(), db, "", "r1"); err != nil {
		t.Fatalf("Read() error = %v", err)
	}
	recs := db.statements()
	if len(recs) != 1 {
		t.Fatalf("expected 1 statement, got %d", len(recs))
	}
	wantSQL := "SELECT * FROM items WHERE id=$1 AND status!='deleted'"
	if recs[0].sql != wantSQL {
		t.Fatalf("select SQL = %q, want %q", recs[0].sql, wantSQL)
	}
	if len(recs[0].args) != 1 || recs[0].args[0] != "r1" {
		t.Fatalf("select args = %v, want [r1]", recs[0].args)
	}
}

// A database failure must stay a failure. Reporting it as ErrRowNotFound would
// have the handler answer 404 for a broken database.
func TestReadRowPropagatesDatabaseError(t *testing.T) {
	svc := NewService(nil)
	if err := svc.RegisterEditor(context.Background(), "t1", "items", &models.RowEditorSpecRequest{
		TableName: "items", PrimaryKey: "id", Columns: reqColumns(),
	}); err != nil {
		t.Fatalf("RegisterEditor() error = %v", err)
	}
	db := &fakeDB{affected: 1, failGet: true}

	resp, err := svc.ReadRow(context.Background(), "t1", "items", db, "r1")
	if err == nil {
		t.Fatal("ReadRow() returned no error when the query failed")
	}
	if resp != nil {
		t.Fatalf("ReadRow returned %+v with an error", resp)
	}
	if errors.Is(err, roweditor.ErrRowNotFound) {
		t.Fatalf("a driver failure was reported as a missing row: %v", err)
	}
	if got := len(db.statements()); got != 1 {
		t.Fatalf("statements = %d, want 1: the failure must not retry or re-read", got)
	}
}

func TestStatsReturnsEditorNotFound(t *testing.T) {
	svc := NewService(nil)
	_, err := svc.Stats(context.Background(), "t1", "ghost")
	if !errors.Is(err, roweditor.ErrEditorNotFound) {
		t.Fatalf("Stats() error = %v, want ErrEditorNotFound", err)
	}

	if err := svc.RegisterEditor(context.Background(), "t1", "items", &models.RowEditorSpecRequest{
		TableName: "items", PrimaryKey: "id",
		Columns: []models.ColumnSpec{{Name: "id"}, {Name: "name", ReadOnly: true}},
	}); err != nil {
		t.Fatalf("RegisterEditor() error = %v", err)
	}
	stats, err := svc.Stats(context.Background(), "t1", "items")
	if err != nil {
		t.Fatalf("Stats() error = %v", err)
	}
	if stats.TableName != "items" || stats.Columns != 2 {
		t.Fatalf("Stats() = %+v", stats)
	}
	if len(stats.ReadOnly) != 1 || stats.ReadOnly[0] != "name" {
		t.Fatalf("Stats() read-only = %v, want [name]", stats.ReadOnly)
	}
}

func TestEditorKeyDoesNotCollide(t *testing.T) {
	// tenant "a", name "b" and tenant "a.b", name "" produce the same key with a
	// plain separator.
	if editorKey("a", "b") == editorKey("a.b", "") {
		t.Fatal("editorKey collides on a.b/empty")
	}
	if editorKey("a", "b") == editorKey("a", "b"+"\x00") {
		t.Fatal("editorKey collides on a trailing separator")
	}
	if editorKey("a", "b") != "a\x00b" {
		t.Fatalf("editorKey() = %q", editorKey("a", "b"))
	}
}
