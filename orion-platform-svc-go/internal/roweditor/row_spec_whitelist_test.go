package roweditor

import (
	"context"
	"errors"
	"strings"
	"testing"
)

// This file pins the spec-column whitelist.
//
// RowEditor is generic: a caller registers a table and its columns, and the
// editor then renders whatever column names the caller later submits into
// "UPDATE <table> SET <keys>=$N WHERE ..." and "INSERT INTO <table> (<keys>)
// VALUES (:k, ...)". The keys therefore come from the request body of a table
// someone else chose.
//
// Before the fix only EditCell checked membership. validateEdit and
// validateBatch walked the spec looking for the caller's keys but never
// rejected a key they did not find, and buildInsertColumnArgs filtered only
// tenant_id and read-only columns. A body such as {"tenant_id":"other"} passed
// every validator and was bound into the SET clause, relocating a row into a
// tenant the caller does not belong to through PUT /rows/:editor and
// POST /rows/:editor/batch-update.

func TestUpdateRejectsAColumnOutsideTheSpec(t *testing.T) {
	db := newStrictDB(t)
	ed := mustEditor(t, itemsSpec()) // declares id, name, version

	for _, bad := range []string{
		"namne",      // typo of a declared column
		"tenant_id",  // a real column of items, not declared by the spec
		"password",   // an undeclared column that could exist on some table
		"created_at", // an undeclared immutable column
	} {
		_, err := ed.Update(context.Background(), db, EditOptions{TenantID: "t1"},
			RowChange{RowID: "r1", Columns: map[string]any{"name": "n", bad: "x"}})
		if !errors.Is(err, ErrValidationError) {
			t.Fatalf("column %q: error = %v, want ErrValidationError", bad, err)
		}
		if !strings.Contains(err.Error(), bad) {
			t.Fatalf("column %q: error %q does not name the rejected column", bad, err.Error())
		}
	}
	// A rejected edit must not touch the database at all.
	if n := len(db.records()); n != 0 {
		t.Fatalf("a rejected edit must not reach the database, got %d statements", n)
	}
}

func TestBatchUpdateRejectsAColumnOutsideTheSpecAndNeverOpensATransaction(t *testing.T) {
	db := newStrictDB(t)
	ed := mustEditor(t, itemsSpec())

	_, err := ed.BatchUpdate(context.Background(), db, EditOptions{TenantID: "t1", Version: 1},
		BatchChange{RowIDs: []string{"r1", "r2", "r3"}, Columns: map[string]any{"name": "bulk", "tenant_id": "other"}})
	if !errors.Is(err, ErrValidationError) {
		t.Fatalf("error = %v, want ErrValidationError", err)
	}
	// Validation runs before BeginTxx, so nothing was begun and nothing was
	// written: the three row ids must not have been touched either.
	if n := len(db.records()); n != 0 {
		t.Fatalf("a rejected batch must not open a transaction or write, got %d statements", n)
	}
}

func TestCreateRejectsAColumnOutsideTheSpec(t *testing.T) {
	db := newStrictDB(t)
	ed := mustEditor(t, simpleSpec()) // declares id, name, note

	_, err := ed.Create(context.Background(), db, "t1",
		Row{"id": "r1", "name": "n", "password": "secret", "tenant_id": "attacker"})
	if !errors.Is(err, ErrValidationError) {
		t.Fatalf("error = %v, want ErrValidationError", err)
	}
	if n := len(db.records()); n != 0 {
		t.Fatalf("a rejected create must not reach the database, got %d statements", n)
	}
}

func TestValidateRowRejectsAColumnOutsideTheSpec(t *testing.T) {
	ed := mustEditor(t, simpleSpec())

	for _, bad := range []string{"namne", "password", "created_at", "no_such_column"} {
		err := ed.validateRow(Row{"id": "r1", "name": "n", bad: "x"})
		if !errors.Is(err, ErrValidationError) {
			t.Fatalf("column %q: error = %v, want ErrValidationError", bad, err)
		}
	}
}

// tenant_id is the one key the insert path tolerates. buildInsertColumnArgs
// discards the caller's value and stamps the tenant authenticated upstream, so
// the value is inert rather than a SQL escape. Rejecting it here would turn a
// client that echoes a whole row back into a hard failure.
func TestValidateRowToleratesACallerTenantID(t *testing.T) {
	ed := mustEditor(t, simpleSpec())
	if err := ed.validateRow(Row{"id": "r1", "name": "n", "tenant_id": "attacker"}); err != nil {
		t.Fatalf("tenant_id is discarded and restamped by the editor: error = %v, want nil", err)
	}
}

func TestValidateCellReportsAnUnknownColumnAsAValidationError(t *testing.T) {
	ed := mustEditor(t, itemsSpec())

	err := ed.validateCell(CellChange{RowID: "r1", Column: "tenant_id", Value: "other"})
	if !errors.Is(err, ErrValidationError) {
		t.Fatalf("error = %v, want ErrValidationError so respondEditError answers 400 instead of 500", err)
	}
	if !strings.Contains(err.Error(), "tenant_id") {
		t.Fatalf("error %q does not name the rejected column", err.Error())
	}

	// A declared, writable column must still pass.
	if err := ed.validateCell(CellChange{RowID: "r1", Column: "name", Value: "n"}); err != nil {
		t.Fatalf("validateCell(name) error = %v, want nil", err)
	}
}

// Guard against an over-strict whitelist: every column the spec declares
// writable must remain writable, and the rendered statement must carry all of
// them with placeholders that line up with the args.
func TestValidateEditAcceptsEveryDeclaredWritableColumn(t *testing.T) {
	db := newStrictDB(t)
	ed := mustEditor(t, RowSpec{
		TableName:  "items",
		PrimaryKey: "id",
		Columns:    []ColumnSpec{{Name: "id"}, {Name: "name"}, {Name: "note"}, {Name: "tags"}},
	})

	_, err := ed.Update(context.Background(), db, EditOptions{TenantID: "t1"},
		RowChange{RowID: "r1", Columns: map[string]any{"name": "n", "note": "x", "tags": "a,b"}})
	if err != nil {
		t.Fatalf("Update() error = %v, want nil", err)
	}
	recs := db.records()
	if len(recs) != 1 {
		t.Fatalf("expected 1 statement, got %d", len(recs))
	}
	want := "UPDATE items SET name=$1, note=$2, tags=$3, updated_at=now() WHERE id=$4 AND tenant_id=$5 AND status!='deleted'"
	if recs[0].sql != want {
		t.Fatalf("update SQL = %q\n  want %q", recs[0].sql, want)
	}
	wantArgs := []any{"n", "x", "a,b", "r1", "t1"}
	if len(recs[0].args) != len(wantArgs) {
		t.Fatalf("update args = %v, want %v", recs[0].args, wantArgs)
	}
	for i := range wantArgs {
		if recs[0].args[i] != wantArgs[i] {
			t.Fatalf("update arg %d = %v, want %v", i, recs[0].args[i], wantArgs[i])
		}
	}
}

// The builders own the second line of defence. Even a caller that reaches
// buildInsertColumnArgs without going through a validator cannot name a column
// the spec never declared, and the tenant stamp must survive the filter.
func TestBuildInsertColumnArgsDropsColumnsOutsideTheSpec(t *testing.T) {
	ed := mustEditor(t, simpleSpec())

	keys, vals, args := ed.buildInsertColumnArgs(Row{
		"id":         "r1",
		"name":       "n",
		"note":       "x",
		"password":   "secret",
		"created_at": "2020-01-01",
		"tenant_id":  "attacker",
	}, "t1")

	if keys != "id, name, note, tenant_id" {
		t.Fatalf("columns = %q, want %q", keys, "id, name, note, tenant_id")
	}
	if vals != ":id, :name, :note, :tenant_id" {
		t.Fatalf("placeholders = %q", vals)
	}
	if args["tenant_id"] != "t1" {
		t.Fatalf("tenant_id = %v, want t1 (the authenticated tenant, not the caller's %q)", args["tenant_id"], "attacker")
	}
	for _, forbidden := range []string{"password", "created_at"} {
		if _, ok := args[forbidden]; ok {
			t.Fatalf("%q is not in the spec but reached the INSERT args: %v", forbidden, args)
		}
	}
}

// The rejected column is reported deterministically: Go maps iterate in
// unspecified order, so an unsorted walk would name a different column on each
// call and make the failure unrepeatable.
func TestValidateEditNamesTheLexicographicallyFirstUndeclaredColumn(t *testing.T) {
	ed := mustEditor(t, itemsSpec())
	for i := 0; i < 300; i++ {
		err := ed.validateEdit(EditOptions{TenantID: "t1"},
			RowChange{RowID: "r1", Columns: map[string]any{
				"zebra":  "z",
				"middle": "m",
				"alpha":  "a",
			}})
		if !errors.Is(err, ErrValidationError) {
			t.Fatalf("iteration %d: error = %v, want ErrValidationError", i, err)
		}
		if !strings.Contains(err.Error(), `"alpha"`) {
			t.Fatalf("iteration %d: error %q must name the first undeclared column, alpha", i, err.Error())
		}
	}
}
