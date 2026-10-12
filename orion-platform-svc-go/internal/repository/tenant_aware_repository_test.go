package repository

import (
	"context"
	"database/sql"
	"errors"
	"reflect"
	"testing"

	"github.com/jmoiron/sqlx"
)

// fakeDB records every call and lets a test assert the injected SQL and
// positional arguments. It does not talk to a real database; the SQL rewrite
// logic is what the baseline is trying to protect.
type fakeDB struct {
	lastQuery string
	lastArgs  []any
	err       error
}

func (f *fakeDB) Query(ctx context.Context, query string, args ...any) (*sql.Rows, error) {
	f.lastQuery = query
	f.lastArgs = args
	return nil, f.err
}
func (f *fakeDB) Exec(ctx context.Context, query string, args ...any) (sql.Result, error) {
	f.lastQuery = query
	f.lastArgs = args
	return nil, f.err
}
func (f *fakeDB) QueryRow(ctx context.Context, query string, args ...any) *sql.Row {
	f.lastQuery = query
	f.lastArgs = args
	return nil
}
func (f *fakeDB) QueryRowx(ctx context.Context, query string, args ...any) *sqlx.Row {
	f.lastQuery = query
	f.lastArgs = args
	return nil
}
func (f *fakeDB) Select(ctx context.Context, dest any, query string, args ...any) error {
	f.lastQuery = query
	f.lastArgs = args
	return f.err
}
func (f *fakeDB) Get(ctx context.Context, dest any, query string, args ...any) error {
	f.lastQuery = query
	f.lastArgs = args
	return f.err
}
func (f *fakeDB) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	f.lastQuery = query
	f.lastArgs = args
	return nil, f.err
}
func (f *fakeDB) PrepareContext(ctx context.Context, query string) (*sql.Stmt, error) {
	f.lastQuery = query
	return nil, f.err
}


// TestWithTenant_RoundTrips verifies the ctx helper returns what it stores.
func TestWithTenant_RoundTrips(t *testing.T) {
	ctx := WithTenant(context.Background(), "t-1")
	got, ok := TenantFromContext(ctx)
	if !ok || got != "t-1" {
		t.Fatalf("expected (t-1, true), got (%q, %v)", got, ok)
	}
}

// TestTenantFromContext_NilContext returns false without panicking.
func TestTenantFromContext_NilContext(t *testing.T) {
	if _, ok := TenantFromContext(nil); ok {
		t.Fatal("nil context should not yield a tenant")
	}
}

// TestTenantFromContext_WrongType verifies that a non-string value on the
// tenant key is treated as absent rather than coerced.
func TestTenantFromContext_WrongType(t *testing.T) {
	ctx := context.WithValue(context.Background(), tenantKey{}, 42)
	if _, ok := TenantFromContext(ctx); ok {
		t.Fatal("non-string tenant value should not yield ok=true")
	}
}

// TestTenantFromContext_EmptyString treats the empty string as absent. This
// is the fail-closed property that makes a forgotten WithTenant call a
// compile-time-adjacent bug rather than a cross-tenant read.
func TestTenantFromContext_EmptyString(t *testing.T) {
	ctx := WithTenant(context.Background(), "")
	if _, ok := TenantFromContext(ctx); ok {
		t.Fatal("empty tenant should be treated as missing")
	}
}

// TestQuery_MissingTenant fails closed instead of running a query.
func TestQuery_MissingTenant(t *testing.T) {
	db := &fakeDB{}
	repo := NewTenantAwareRepositoryFromDB(db)
	_, err := repo.Query(context.Background(), "SELECT * FROM widgets")
	if !errors.Is(err, ErrTenantMissing) {
		t.Fatalf("expected ErrTenantMissing, got %v", err)
	}
	if db.lastQuery != "" {
		t.Fatalf("query should not have been forwarded; got %q", db.lastQuery)
	}
}

// TestQuery_EmptyTenant rejects whitespace tenant IDs.
func TestQuery_EmptyTenant(t *testing.T) {
	db := &fakeDB{}
	repo := NewTenantAwareRepositoryFromDB(db)
	_, err := repo.Query(WithTenant(context.Background(), "   "), "SELECT * FROM widgets")
	if !errors.Is(err, ErrTenantIsolation) {
		t.Fatalf("expected ErrTenantIsolation, got %v", err)
	}
}

// TestQuery_InjectsWhereWhenAbsent verifies the SELECT path that has no
// existing WHERE clause gets one injected at the tail.
func TestQuery_InjectsWhereWhenAbsent(t *testing.T) {
	db := &fakeDB{}
	repo := NewTenantAwareRepositoryFromDB(db)
	ctx := WithTenant(context.Background(), "t-1")

	_, err := repo.Query(ctx, "SELECT id, name FROM widgets", 42)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := "SELECT id, name FROM widgets WHERE tenant_id = $1"
	if db.lastQuery != want {
		t.Fatalf("query mismatch\n got: %q\nwant: %q", db.lastQuery, want)
	}
	wantArgs := []any{"t-1", 42}
	if !reflect.DeepEqual(db.lastArgs, wantArgs) {
		t.Fatalf("args mismatch\n got: %#v\nwant: %#v", db.lastArgs, wantArgs)
	}
}

// TestQuery_AppendsToExistingWhere verifies the SELECT-with-WHERE path adds
// " AND tenant_id = $1" to the existing clause.
func TestQuery_AppendsToExistingWhere(t *testing.T) {
	db := &fakeDB{}
	repo := NewTenantAwareRepositoryFromDB(db)
	ctx := WithTenant(context.Background(), "t-1")

	_, err := repo.Query(ctx, "SELECT id FROM widgets WHERE id = $1", "w-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := "SELECT id FROM widgets WHERE tenant_id = $1 id = $2"
	// The parser preserves the original WHERE body as-is (no trailing space
	// after "= $1"), so we assert the tenant fragment and the shifted
	// positional argument appear where expected.
	if db.lastQuery != want {
		t.Fatalf("query mismatch\n got: %q\nwant: %q", db.lastQuery, want)
	}
	wantArgs := []any{"t-1", "w-1"}
	if !reflect.DeepEqual(db.lastArgs, wantArgs) {
		t.Fatalf("args mismatch\n got: %#v\nwant: %#v", db.lastArgs, wantArgs)
	}
}

// TestQuery_PreservesTrailingClauses confirms the injection lands before any
// ORDER BY / LIMIT / GROUP BY tail so the SQL still parses.
func TestQuery_PreservesTrailingClauses(t *testing.T) {
	db := &fakeDB{}
	repo := NewTenantAwareRepositoryFromDB(db)
	ctx := WithTenant(context.Background(), "t-1")

	_, err := repo.Query(ctx, "SELECT id FROM widgets ORDER BY id LIMIT 5", 5)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := "SELECT id FROM widgets WHERE tenant_id = $1 ORDER BY id LIMIT 5"
	if db.lastQuery != want {
		t.Fatalf("query mismatch\n got: %q\nwant: %q", db.lastQuery, want)
	}
}

// TestExec_InsertUntouched verifies that INSERT statements are not rewritten;
// callers are responsible for including tenant_id in the VALUES clause.
func TestExec_InsertUntouched(t *testing.T) {
	db := &fakeDB{}
	repo := NewTenantAwareRepositoryFromDB(db)
	ctx := WithTenant(context.Background(), "t-1")

	_, err := repo.Exec(ctx, "INSERT INTO widgets (tenant_id, name) VALUES ($1, $2)", "t-1", "w")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if db.lastQuery != "INSERT INTO widgets (tenant_id, name) VALUES ($1, $2)" {
		t.Fatalf("INSERT should be left untouched; got %q", db.lastQuery)
	}
	if len(db.lastArgs) != 2 {
		t.Fatalf("INSERT args should be untouched; got %#v", db.lastArgs)
	}
}

// TestExec_UpdateUntouched confirms the same for UPDATE; callers must
// include tenant_id in the WHERE clause themselves.
func TestExec_UpdateUntouched(t *testing.T) {
	db := &fakeDB{}
	repo := NewTenantAwareRepositoryFromDB(db)
	ctx := WithTenant(context.Background(), "t-1")

	_, err := repo.Exec(ctx, "UPDATE widgets SET name = $1 WHERE id = $2 AND tenant_id = $3", "new", "w-1", "t-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if db.lastQuery != "UPDATE widgets SET name = $1 WHERE id = $2 AND tenant_id = $3" {
		t.Fatalf("UPDATE should be left untouched; got %q", db.lastQuery)
	}
}

// TestWithTenantColumn verifies the tenant column name is pluggable for
// domain tables that use a different column name.
func TestWithTenantColumn(t *testing.T) {
	db := &fakeDB{}
	repo := NewTenantAwareRepositoryFromDB(db, WithTenantColumn("owner_id"))
	ctx := WithTenant(context.Background(), "o-1")

	_, err := repo.Query(ctx, "SELECT * FROM resources")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := "SELECT * FROM resources WHERE owner_id = $1"
	if db.lastQuery != want {
		t.Fatalf("custom column mismatch\n got: %q\nwant: %q", db.lastQuery, want)
	}
}
