package roweditor

import (
	"context"
	"database/sql"
	"errors"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"testing"
)

// mustEditor builds an editor or fails the test.
func mustEditor(t *testing.T, spec RowSpec) *RowEditor {
	t.Helper()
	ed, err := NewRowEditor(spec)
	if err != nil {
		t.Fatalf("NewRowEditor() error = %v", err)
	}
	return ed
}

// placeholderMax returns the highest $N used by a query, or 0 for a statement
// that binds nothing. strictDB compares it against len(args): a query with an
// unbound placeholder fails at the database, and one with a leftover argument
// binds a value to the wrong column.
func placeholderMax(query string) int {
	re := regexp.MustCompile(`\$(\d+)`)
	max := 0
	for _, m := range re.FindAllStringSubmatch(query, -1) {
		n, err := strconv.Atoi(m[1])
		if err != nil {
			continue
		}
		if n > max {
			max = n
		}
	}
	return max
}

type execRec struct {
	sql  string
	args []any
}

// strictResult is a sql.Result whose RowsAffected can be driven.
type strictResult struct {
	rowsAffected    int64
	rowsAffectedErr error
}

func (r *strictResult) LastInsertId() (int64, error) { return 0, sql.ErrNoRows }

func (r *strictResult) RowsAffected() (int64, error) { return r.rowsAffected, r.rowsAffectedErr }

// strictDB implements DBOperations and TxOperations on a shared recorder.
//
// It refuses to execute a statement whose placeholder count and argument count
// disagree. The looser mock in db_test.go reads args[0] as the row id and
// checks nothing else, which silently hid two production bugs: buildDeleteQuery
// never bound rowID, and BatchUpdate never received a tenant at all.
type strictDB struct {
	t        *testing.T
	mu       *sync.Mutex
	recorder []execRec
	result   sql.Result
}

// mockTx shares strictDB's recorder so transactional statements are counted
// together with the ones that run outside a transaction.
type mockTx struct{ *strictDB }

func newStrictDB(t *testing.T) *strictDB {
	t.Helper()
	// rowsAffected starts at 1: a statement that matches something succeeded.
	// setRowsAffected overrides it per test.
	return &strictDB{t: t, mu: &sync.Mutex{}, result: &strictResult{rowsAffected: 1}}
}

func (d *strictDB) record(sqlText string, args []any) {
	d.check(sqlText, args)
	d.mu.Lock()
	defer d.mu.Unlock()
	d.recorder = append(d.recorder, execRec{sql: sqlText, args: append([]any(nil), args...)})
}

func (d *strictDB) check(sqlText string, args []any) {
	d.t.Helper()
	maxN := placeholderMax(sqlText)
	if len(args) != maxN {
		d.t.Fatalf("query uses $%d but got %d args\n  sql:  %s\n  args: %v", maxN, len(args), sqlText, args)
	}
}

func (d *strictDB) setRowsAffected(n int64) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.result = &strictResult{rowsAffected: n}
}

func (d *strictDB) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	d.record(query, args)
	return d.result, nil
}

func (d *strictDB) NamedExecContext(ctx context.Context, query string, arg any) (sql.Result, error) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.recorder = append(d.recorder, execRec{sql: query, args: []any{arg}})
	return d.result, nil
}

func (d *strictDB) GetContext(ctx context.Context, dest any, query string, args ...any) error {
	d.record(query, args)
	return nil
}

func (d *strictDB) SelectContext(ctx context.Context, dest any, query string, args ...any) error {
	d.record(query, args)
	return nil
}

func (d *strictDB) BeginTxx(ctx context.Context, cfg *sql.TxOptions) (TxOperations, error) {
	return &mockTx{d}, nil
}

func (d *strictDB) Commit() error   { return nil }
func (d *strictDB) Rollback() error { return nil }

func (d *strictDB) records() []execRec {
	d.mu.Lock()
	defer d.mu.Unlock()
	out := make([]execRec, len(d.recorder))
	copy(out, d.recorder)
	return out
}

func itemsSpec() RowSpec {
	return RowSpec{
		TableName:     "items",
		PrimaryKey:    "id",
		VersionColumn: "version",
		Columns: []ColumnSpec{
			{Name: "id", Type: "uuid"},
			{Name: "name", Type: "varchar"},
			{Name: "version", Type: "int"},
		},
	}
}

func simpleSpec() RowSpec {
	return RowSpec{
		TableName:  "items",
		PrimaryKey: "id",
		Columns: []ColumnSpec{
			{Name: "id"},
			{Name: "name"},
			{Name: "note"},
		},
	}
}

func TestStrictDeleteBindsRowID(t *testing.T) {
	db := newStrictDB(t)
	ed := mustEditor(t, itemsSpec())

	// Hard delete: softDelete is false, which is what service.DeleteRow forced
	// for every editor before it read the spec. buildDeleteQuery used to build
	// "WHERE id=$1" with an empty argument list, so this call always hit an
	// unbound-placeholder error and the DELETE route always answered 500.
	_, err := ed.Delete(context.Background(), db, EditOptions{TenantID: "t1"}, "r1", false)
	if err != nil {
		t.Fatalf("Delete() error = %v", err)
	}

	recs := db.records()
	if len(recs) != 1 {
		t.Fatalf("expected 1 statement, got %d", len(recs))
	}
	got := recs[0]
	wantSQL := "DELETE FROM items WHERE id=$1 AND tenant_id=$2 AND status!='deleted'"
	if got.sql != wantSQL {
		t.Fatalf("delete SQL:\n got %s\nwant %s", got.sql, wantSQL)
	}
	if len(got.args) != 2 {
		t.Fatalf("delete args = %v (len %d), want [r1 t1]", got.args, len(got.args))
	}
	if got.args[0] != "r1" {
		t.Fatalf("delete args[0] = %v, want r1", got.args[0])
	}
	if got.args[1] != "t1" {
		t.Fatalf("delete args[1] = %v, want t1", got.args[1])
	}
}

func TestStrictDeleteBindsVersion(t *testing.T) {
	db := newStrictDB(t)
	ed := mustEditor(t, itemsSpec())

	_, err := ed.Delete(context.Background(), db, EditOptions{TenantID: "t1", Version: 7}, "r1", false)
	if err != nil {
		t.Fatalf("Delete() error = %v", err)
	}
	got := db.records()[0]
	wantSQL := "DELETE FROM items WHERE id=$1 AND tenant_id=$2 AND version=$3 AND status!='deleted'"
	if got.sql != wantSQL {
		t.Fatalf("delete SQL:\n got %s\nwant %s", got.sql, wantSQL)
	}
	if len(got.args) != 3 || got.args[0] != "r1" || got.args[1] != "t1" || got.args[2] != int64(7) {
		t.Fatalf("delete args = %v, want [r1 t1 7]", got.args)
	}
}

func TestStrictUpdateBindsRowIDAndTenant(t *testing.T) {
	db := newStrictDB(t)
	ed := mustEditor(t, itemsSpec())

	_, err := ed.Update(context.Background(), db, EditOptions{TenantID: "t1", Version: 3},
		RowChange{RowID: "r1", Columns: map[string]any{"name": "new"}})
	if err != nil {
		t.Fatalf("Update() error = %v", err)
	}
	got := db.records()[0]
	wantSQL := "UPDATE items SET name=$1, updated_at=now(), version=version+1 WHERE id=$2 AND tenant_id=$3 AND version=$4 AND status!='deleted'"
	if got.sql != wantSQL {
		t.Fatalf("update SQL:\n got %s\nwant %s", got.sql, wantSQL)
	}
	if got.args[0] != "new" || got.args[1] != "r1" || got.args[2] != "t1" || got.args[3] != int64(3) {
		t.Fatalf("update args = %v, want [new r1 t1 3]", got.args)
	}
}

func TestStrictUpdateReturnsRowNotFoundWithoutVersion(t *testing.T) {
	db := newStrictDB(t)
	db.setRowsAffected(0)
	ed := mustEditor(t, itemsSpec())

	_, err := ed.Update(context.Background(), db, EditOptions{TenantID: "t1"},
		RowChange{RowID: "ghost", Columns: map[string]any{"name": "x"}})
	if !errors.Is(err, ErrRowNotFound) {
		t.Fatalf("Update() error = %v, want ErrRowNotFound", err)
	}
}

func TestStrictUpdateReturnsOptimisticLock(t *testing.T) {
	db := newStrictDB(t)
	db.setRowsAffected(0)
	ed := mustEditor(t, itemsSpec())

	_, err := ed.Update(context.Background(), db, EditOptions{TenantID: "t1", Version: 2},
		RowChange{RowID: "r1", Columns: map[string]any{"name": "x"}})
	if !errors.Is(err, ErrOptimisticLock) {
		t.Fatalf("Update() error = %v, want ErrOptimisticLock", err)
	}
}

func TestStrictUpdateRejectsReadOnlyColumn(t *testing.T) {
	db := newStrictDB(t)
	ed := mustEditor(t, RowSpec{
		TableName:  "items",
		PrimaryKey: "id",
		Columns:    []ColumnSpec{{Name: "id"}, {Name: "name"}, {Name: "created_at", ReadOnly: true}},
	})

	_, err := ed.Update(context.Background(), db, EditOptions{TenantID: "t1"},
		RowChange{RowID: "r1", Columns: map[string]any{"created_at": "now"}})
	if !errors.Is(err, ErrReadOnlyField) {
		t.Fatalf("Update() error = %v, want ErrReadOnlyField", err)
	}
	if len(db.records()) != 0 {
		t.Fatalf("rejected edit must not reach the database, got %d statements", len(db.records()))
	}
}

func TestStrictBatchUpdateBumpsVersionOnce(t *testing.T) {
	db := newStrictDB(t)
	ed := mustEditor(t, itemsSpec())

	_, err := ed.BatchUpdate(context.Background(), db, EditOptions{TenantID: "t1", Version: 1},
		BatchChange{RowIDs: []string{"r1", "r2", "r3"}, Columns: map[string]any{"name": "bulk"}})
	if err != nil {
		t.Fatalf("BatchUpdate() error = %v", err)
	}
	recs := db.records()
	if len(recs) != 3 {
		t.Fatalf("expected 3 statements, got %d", len(recs))
	}
	// The version increment belongs to the statement, not to the row: appending
	// it once per row of the batch bumped version by N and defeated the
	// optimistic-lock guard.
	for i, rec := range recs {
		if n := strings.Count(rec.sql, "version=version+1"); n != 1 {
			t.Fatalf("statement %d increments version %d times, want 1\n  sql: %s", i, n, rec.sql)
		}
	}
}

func TestStrictBatchUpdateIsTenantScoped(t *testing.T) {
	db := newStrictDB(t)
	ed := mustEditor(t, itemsSpec())

	_, err := ed.BatchUpdate(context.Background(), db, EditOptions{TenantID: "t1", Version: 1},
		BatchChange{RowIDs: []string{"r1", "r2"}, Columns: map[string]any{"name": "bulk"}})
	if err != nil {
		t.Fatalf("BatchUpdate() error = %v", err)
	}
	recs := db.records()
	if len(recs) != 2 {
		t.Fatalf("expected 2 statements, got %d", len(recs))
	}
	want := "UPDATE items SET name=$1, updated_at=now(), version=version+1 WHERE id=$2 AND tenant_id=$3 AND version=$4 AND status!='deleted'"
	for i, rec := range recs {
		if rec.sql != want {
			t.Fatalf("statement %d:\n got %s\nwant %s", i, rec.sql, want)
		}
		if rec.args[2] != "t1" {
			t.Fatalf("statement %d args = %v, want tenant t1 at $3", i, rec.args)
		}
	}
	// Each row must keep its own id: a shared backing array would let the last
	// row overwrite the earlier ones.
	if recs[0].args[1] != "r1" || recs[1].args[1] != "r2" {
		t.Fatalf("batch args drifted across rows: %v / %v", recs[0].args, recs[1].args)
	}
}

func TestStrictBatchUpdateFailsWithoutTenant(t *testing.T) {
	db := newStrictDB(t)
	ed := mustEditor(t, itemsSpec())

	_, err := ed.BatchUpdate(context.Background(), db, EditOptions{Version: 1},
		BatchChange{RowIDs: []string{"r1"}, Columns: map[string]any{"name": "bulk"}})
	if err != nil {
		t.Fatalf("BatchUpdate() error = %v", err)
	}
	rec := db.records()[0]
	if strings.Contains(rec.sql, "tenant_id") {
		t.Fatalf("statement must carry a tenant predicate, got %q", rec.sql)
	}
}

func TestStrictBatchUpdateAppliesVersionGuardPerRow(t *testing.T) {
	db := newStrictDB(t)
	ed := mustEditor(t, RowSpec{
		TableName:     "items",
		PrimaryKey:    "id",
		VersionColumn: "version",
		Columns:       []ColumnSpec{{Name: "id"}, {Name: "name"}, {Name: "version"}},
	})

	_, err := ed.BatchUpdate(context.Background(), db, EditOptions{TenantID: "t1", Version: 4},
		BatchChange{RowIDs: []string{"r1", "r2"}, Columns: map[string]any{"name": "b"}})
	if err != nil {
		t.Fatalf("BatchUpdate() error = %v", err)
	}
	rec := db.records()[0]
	if !strings.Contains(rec.sql, "version=$4") {
		t.Fatalf("batch statement lost the version guard: %s", rec.sql)
	}
	if rec.args[3] != int64(4) {
		t.Fatalf("batch version arg = %v, want 4", rec.args[3])
	}
}

func TestStrictCreateStampsAuthenticatedTenant(t *testing.T) {
	db := newStrictDB(t)
	ed := mustEditor(t, simpleSpec())

	// The caller puts its own tenant_id in the row map; the editor must discard
	// it and stamp the authenticated value instead.
	row := Row{"id": "r1", "name": "n", "tenant_id": "attacker", "note": "x"}
	created, err := ed.Create(context.Background(), db, "t1", row)
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	args, ok := db.records()[0].args[0].(map[string]any)
	if !ok {
		t.Fatalf("insert arg is %T, want map[string]any", db.records()[0].args[0])
	}
	if args["tenant_id"] != "t1" {
		t.Fatalf("insert tenant_id = %v, want t1 (the caller supplied %q)", args["tenant_id"], row["tenant_id"])
	}
	if (*created)["tenant_id"] != "t1" {
		t.Fatalf("returned row tenant_id = %v, want t1", (*created)["tenant_id"])
	}
	wantSQL := "INSERT INTO items (id, name, note, tenant_id) VALUES (:id, :name, :note, :tenant_id)"
	if db.records()[0].sql != wantSQL {
		t.Fatalf("insert SQL:\n got %s\nwant %s", db.records()[0].sql, wantSQL)
	}
}

func TestStrictCreateReturnsWrittenRow(t *testing.T) {
	db := newStrictDB(t)
	ed := mustEditor(t, RowSpec{
		TableName:  "items",
		PrimaryKey: "id",
		Columns:    []ColumnSpec{{Name: "id"}, {Name: "name"}},
	})

	created, err := ed.Create(context.Background(), db, "t1", Row{"id": "r1", "name": "n"})
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if len(*created) != 3 {
		t.Fatalf("returned row = %v, want id, name and the tenant stamp", *created)
	}
}

func TestStrictCreateReturnsNoChangesForEmptyRow(t *testing.T) {
	db := newStrictDB(t)
	ed := mustEditor(t, RowSpec{
		TableName:  "items",
		PrimaryKey: "id",
		Columns:    []ColumnSpec{{Name: "id"}},
	})

	_, err := ed.Create(context.Background(), db, "t1", Row{})
	if !errors.Is(err, ErrNoChanges) {
		t.Fatalf("Create() error = %v, want ErrNoChanges", err)
	}
	if len(db.records()) != 0 {
		t.Fatalf("Create() must not touch the database for an empty row, got %d statements", len(db.records()))
	}
}

func TestStrictCreateSkipsTenantWhenTriggerOwned(t *testing.T) {
	db := newStrictDB(t)
	ed := mustEditor(t, RowSpec{
		TableName:  "items",
		PrimaryKey: "id",
		Columns:    []ColumnSpec{{Name: "id"}, {Name: "name"}, {Name: "tenant_id", ReadOnly: true}},
	})

	_, err := ed.Create(context.Background(), db, "t1", Row{"id": "r1", "name": "n"})
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	args := db.records()[0].args[0].(map[string]any)
	if _, ok := args["tenant_id"]; ok {
		t.Fatalf("must not write tenant_id when the spec marks it read-only, args = %v", args)
	}
}

func TestStrictCreateSurfacesRowsAffectedError(t *testing.T) {
	db := newStrictDB(t)
	ed := mustEditor(t, RowSpec{
		TableName:  "items",
		PrimaryKey: "id",
		Columns:    []ColumnSpec{{Name: "id"}, {Name: "name"}},
	})

	// The RowsAffected error used to be discarded, so a metadata failure looked
	// like a successful insert.
	db.result = &strictResult{rowsAffectedErr: errors.New("rows affected unavailable")}
	_, err := ed.Create(context.Background(), db, "t1", Row{"id": "r1", "name": "n"})
	if err == nil {
		t.Fatal("Create() must surface a RowsAffected error")
	}
}

func TestStrictBatchCreateStampsTenantEveryRow(t *testing.T) {
	db := newStrictDB(t)
	ed := mustEditor(t, RowSpec{
		TableName:  "items",
		PrimaryKey: "id",
		Columns:    []ColumnSpec{{Name: "id"}, {Name: "name"}},
	})

	count, err := ed.BatchCreate(context.Background(), db, "t1", []Row{
		{"id": "r1", "name": "a", "tenant_id": "other"},
		{"id": "r2", "name": "b"},
	})
	if err != nil {
		t.Fatalf("BatchCreate() error = %v", err)
	}
	if count != 2 {
		t.Fatalf("BatchCreate() count = %d, want 2", count)
	}
	recs := db.records()
	if len(recs) != 2 {
		t.Fatalf("expected 2 inserts, got %d", len(recs))
	}
	for i, rec := range recs {
		args, ok := rec.args[0].(map[string]any)
		if !ok {
			t.Fatalf("insert %d arg is %T, want map[string]any", i, rec.args[0])
		}
		if args["tenant_id"] != "t1" {
			t.Fatalf("insert %d tenant_id = %v, want t1", i, args["tenant_id"])
		}
	}
}

func TestStrictUpdateCellBindsValueBeforeRowID(t *testing.T) {
	db := newStrictDB(t)
	ed := mustEditor(t, itemsSpec())

	_, err := ed.UpdateCell(context.Background(), db, EditOptions{TenantID: "t1", Version: 1},
		CellChange{RowID: "r1", Column: "name", Value: "cell"})
	if err != nil {
		t.Fatalf("UpdateCell() error = %v", err)
	}
	got := db.records()[0]
	wantSQL := "UPDATE items SET name=$1, updated_at=now(), version=version+1 WHERE id=$2 AND tenant_id=$3 AND version=$4 AND status!='deleted'"
	if got.sql != wantSQL {
		t.Fatalf("update cell SQL:\n got %s\nwant %s", got.sql, wantSQL)
	}
	if got.args[0] != "cell" || got.args[1] != "r1" || got.args[2] != "t1" || got.args[3] != int64(1) {
		t.Fatalf("update cell args = %v, want [cell r1 t1 1]", got.args)
	}
}

func TestStrictUpdateOffsetsWithTwoSetColumns(t *testing.T) {
	db := newStrictDB(t)
	ed := mustEditor(t, RowSpec{
		TableName:     "items",
		PrimaryKey:    "id",
		VersionColumn: "version",
		Columns:       []ColumnSpec{{Name: "id"}, {Name: "name"}, {Name: "note"}, {Name: "version"}},
	})

	_, err := ed.Update(context.Background(), db, EditOptions{TenantID: "t1"},
		RowChange{RowID: "r1", Columns: map[string]any{"name": "n", "note": "x"}})
	if err != nil {
		t.Fatalf("Update() error = %v", err)
	}
	got := db.records()[0]
	// Two SET columns own $1/$2, so the row id must land in $3.
	wantSQL := "UPDATE items SET name=$1, note=$2, updated_at=now() WHERE id=$3 AND tenant_id=$4 AND status!='deleted'"
	if got.sql != wantSQL {
		t.Fatalf("update SQL:\n got %s\nwant %s", got.sql, wantSQL)
	}
	if got.args[2] != "r1" || got.args[3] != "t1" {
		t.Fatalf("update args = %v, want row id at $3 and tenant at $4", got.args)
	}
}

func TestStrictReadBindsTenant(t *testing.T) {
	db := newStrictDB(t)
	ed := mustEditor(t, simpleSpec())

	_, err := ed.Read(context.Background(), db, "t1", "r1")
	if err != nil {
		t.Fatalf("Read() error = %v", err)
	}
	got := db.records()[0]
	wantSQL := "SELECT * FROM items WHERE id=$1 AND tenant_id=$2 AND status!='deleted'"
	if got.sql != wantSQL {
		t.Fatalf("read SQL:\n got %s\nwant %s", got.sql, wantSQL)
	}
	if len(got.args) != 2 || got.args[0] != "r1" || got.args[1] != "t1" {
		t.Fatalf("read args = %v, want [r1 t1]", got.args)
	}
}

func TestStrictReadWithoutTenantPassesOneArg(t *testing.T) {
	db := newStrictDB(t)
	ed := mustEditor(t, simpleSpec())

	// buildSelectQuery binds tenant_id only when the tenant is non-empty, so the
	// argument list must drop it too. Sending the empty string anyway handed the
	// driver an argument for a placeholder that does not exist.
	_, err := ed.Read(context.Background(), db, "", "r1")
	if err != nil {
		t.Fatalf("Read() error = %v", err)
	}
	got := db.records()[0]
	wantSQL := "SELECT * FROM items WHERE id=$1 AND status!='deleted'"
	if got.sql != wantSQL {
		t.Fatalf("read SQL:\n got %s\nwant %s", got.sql, wantSQL)
	}
	if len(got.args) != 1 || got.args[0] != "r1" {
		t.Fatalf("read args = %v, want [r1]", got.args)
	}
}

func TestStrictSoftDeleteNumbersFromOne(t *testing.T) {
	db := newStrictDB(t)
	ed := mustEditor(t, itemsSpec())

	// SET status='deleted' binds nothing, so the WHERE clause keeps its $1 start.
	_, err := ed.Delete(context.Background(), db, EditOptions{TenantID: "t1", Version: 3}, "r1", true)
	if err != nil {
		t.Fatalf("Delete() error = %v", err)
	}
	got := db.records()[0]
	wantSQL := "UPDATE items SET status='deleted', updated_at=now() WHERE id=$1 AND tenant_id=$2 AND version=$3 AND status!='deleted'"
	if got.sql != wantSQL {
		t.Fatalf("soft delete SQL:\n got %s\nwant %s", got.sql, wantSQL)
	}
	if got.args[0] != "r1" || got.args[1] != "t1" || got.args[2] != int64(3) {
		t.Fatalf("soft delete args = %v, want [r1 t1 3]", got.args)
	}
}

func TestStrictBatchDeleteBindsRowIDAndTenant(t *testing.T) {
	db := newStrictDB(t)
	ed := mustEditor(t, simpleSpec())

	results, err := ed.BatchDelete(context.Background(), db, EditOptions{TenantID: "t1"}, []string{"r1", "r2"})
	if err != nil {
		t.Fatalf("BatchDelete() error = %v", err)
	}
	if len(results) != 2 {
		t.Fatalf("BatchDelete() results = %d, want 2", len(results))
	}
	recs := db.records()
	if len(recs) != 2 {
		t.Fatalf("expected 2 statements, got %d", len(recs))
	}
	want := "UPDATE items SET status='deleted', updated_at=now() WHERE id=$1 AND tenant_id=$2 AND status!='deleted'"
	for i, rec := range recs {
		if rec.sql != want {
			t.Fatalf("statement %d:\n got %s\nwant %s", i, rec.sql, want)
		}
		if rec.args[0] != []string{"r1", "r2"}[i] || rec.args[1] != "t1" {
			t.Fatalf("statement %d args = %v, want [rowID t1]", i, rec.args)
		}
	}
}

func TestValidateRowRunsValidatorOnAbsentColumn(t *testing.T) {
	ed := mustEditor(t, RowSpec{
		TableName:  "items",
		PrimaryKey: "id",
		Columns: []ColumnSpec{
			{Name: "id"},
			{Name: "name", Validate: ValidateRequired},
		},
	})

	// A required column was only enforced when the key was present: omitting it
	// was the easy way around the rule.
	err := ed.validateRow(Row{"id": "r1"})
	if !errors.Is(err, ErrValidationError) {
		t.Fatalf("validateRow() error = %v, want ErrValidationError", err)
	}
	if err := ed.validateRow(Row{"id": "r1", "name": ""}); err == nil {
		t.Fatal("validateRow() must reject an empty required column")
	}
	if err := ed.validateRow(Row{"id": "r1", "name": "ok"}); err != nil {
		t.Fatalf("validateRow() error = %v, want nil", err)
	}
}

func TestValidateRequired(t *testing.T) {
	cases := []struct {
		value   any
		wantErr bool
	}{
		{nil, true},
		{"", true},
		{"x", false},
		{0, false},
		{false, false},
		{map[string]any{}, false},
	}
	for _, c := range cases {
		if got := ValidateRequired(c.value); (got != nil) != c.wantErr {
			t.Fatalf("ValidateRequired(%v) error = %v, wantErr %v", c.value, got, c.wantErr)
		}
	}
}

func TestBuildDeleteQueryBindsRowID(t *testing.T) {
	q, args := buildDeleteQuery("items", "id", "r1", "t1", 3, "version")
	want := "DELETE FROM items WHERE id=$1 AND tenant_id=$2 AND version=$3 AND status!='deleted'"
	if q != want {
		t.Fatalf("buildDeleteQuery() = %q, want %q", q, want)
	}
	// The query declares three placeholders, so the argument list must hold
	// three values; an empty list is an unbound placeholder at the driver.
	if len(args) != 3 {
		t.Fatalf("buildDeleteQuery() args = %v (len %d), want 3", args, len(args))
	}
	if args[0] != "r1" {
		t.Fatalf("buildDeleteQuery() args[0] = %v, want r1", args[0])
	}
}

func TestBuildUpdateSetClauseIncrementsVersionOnce(t *testing.T) {
	clause, args := buildUpdateSetClause(map[string]any{"name": "n", "note": "x"}, 2, "version")
	want := "name=$1, note=$2, updated_at=now(), version=version+1"
	if clause != want {
		t.Fatalf("buildUpdateSetClause() = %q, want %q", clause, want)
	}
	if len(args) != 2 {
		t.Fatalf("buildUpdateSetClause() args = %v, want 2 column values", args)
	}
	if strings.Count(clause, "version=version+1") != 1 {
		t.Fatalf("buildUpdateSetClause() increments version %d times, want 1", strings.Count(clause, "version=version+1"))
	}
	clauseNoVersion, argsNoVersion := buildUpdateSetClause(map[string]any{"name": "n"}, 0, "version")
	if clauseNoVersion != "name=$1, updated_at=now()" {
		t.Fatalf("buildUpdateSetClause() no-version = %q", clauseNoVersion)
	}
	if len(argsNoVersion) != 1 {
		t.Fatalf("buildUpdateSetClause() no-version args = %v", argsNoVersion)
	}
}
