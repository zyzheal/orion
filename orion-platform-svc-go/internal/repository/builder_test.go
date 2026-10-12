package repository

import (
	"errors"
	"reflect"
	"testing"
)

// TestWhereTenant_InjectsTenantFirst verifies the tenant ID is always at
// $1 regardless of how many clauses follow.
func TestWhereTenant_InjectsTenantFirst(t *testing.T) {
	b := WhereTenant("t-1")
	q, err := b.String()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if q != "WHERE tenant_id = $1" {
		t.Fatalf("query mismatch: %q", q)
	}
	args, _ := b.Args()
	if len(args) != 1 || args[0] != "t-1" {
		t.Fatalf("args mismatch: %#v", args)
	}
}

// TestWhereTenant_RequiresTenant asserts the fail-closed contract: an
// empty tenantID makes every terminal method return ErrTenantRequired.
func TestWhereTenant_RequiresTenant(t *testing.T) {
	b := WhereTenant("")
	if _, err := b.String(); !errors.Is(err, ErrTenantRequired) {
		t.Fatalf("expected ErrTenantRequired, got %v", err)
	}
	if _, err := b.Args(); !errors.Is(err, ErrTenantRequired) {
		t.Fatalf("Args expected ErrTenantRequired, got %v", err)
	}
}

// TestWhereTenant_SingleClause verifies the "?" marker is renamed to the
// next free $-number and the value is captured.
func TestWhereTenant_SingleClause(t *testing.T) {
	b := WhereTenant("t-1", "id = ?", "w-1")
	q, err := b.String()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if q != "WHERE tenant_id = $1 AND id = $2" {
		t.Fatalf("query mismatch: %q", q)
	}
	args, _ := b.Args()
	want := []any{"t-1", "w-1"}
	if !reflect.DeepEqual(args, want) {
		t.Fatalf("args mismatch\n got: %#v\nwant: %#v", args, want)
	}
}

// TestWhereTenant_MultipleClauses verifies auto-renumbering across
// multiple clauses — the class of bugs the builder eliminates.
func TestWhereTenant_MultipleClauses(t *testing.T) {
	b := WhereTenant("t-1",
		"id = ?", "w-1",
		"status = ?", "active",
		"priority > ?", 3,
	)
	q, err := b.String()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if q != "WHERE tenant_id = $1 AND id = $2 AND status = $3 AND priority > $4" {
		t.Fatalf("query mismatch: %q", q)
	}
	args, _ := b.Args()
	want := []any{"t-1", "w-1", "active", 3}
	if !reflect.DeepEqual(args, want) {
		t.Fatalf("args mismatch\n got: %#v\nwant: %#v", args, want)
	}
}

// TestWhereTenant_OrderByLimitOffset verifies ORDER BY tail and auto-
// numbered LIMIT/OFFSET placeholders.
func TestWhereTenant_OrderByLimitOffset(t *testing.T) {
	b := WhereTenant("t-1",
		"status = ?", "active",
	).OrderBy("created_at DESC").Limit(20).Offset(0)
	q, err := b.String()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Expect: WHERE tenant_id=$1 AND status=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4
	if q != "WHERE tenant_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4" {
		t.Fatalf("query mismatch: %q", q)
	}
	args, _ := b.Args()
	want := []any{"t-1", "active", 20, 0}
	if !reflect.DeepEqual(args, want) {
		t.Fatalf("args mismatch\n got: %#v\nwant: %#v", args, want)
	}
}

// TestWhereTenantColumn_CustomColumn confirms the tenant column override
// path is honoured end-to-end.
func TestWhereTenantColumn_CustomColumn(t *testing.T) {
	b := WhereTenantColumn("o-1", "owner_id", "id = ?", "r-1")
	q, err := b.String()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if q != "WHERE owner_id = $1 AND id = $2" {
		t.Fatalf("query mismatch: %q", q)
	}
	args, _ := b.Args()
	want := []any{"o-1", "r-1"}
	if !reflect.DeepEqual(args, want) {
		t.Fatalf("args mismatch: %#v", args)
	}
}

// TestWhereTenantColumn_EmptyColumnFallsBackToTenantID verifies that an
// empty custom column name silently falls back to the default "tenant_id"
// rather than emitting an invalid SQL fragment.
func TestWhereTenantColumn_EmptyColumnFallsBackToTenantID(t *testing.T) {
	b := WhereTenantColumn("t-1", "")
	q, err := b.String()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if q != "WHERE tenant_id = $1" {
		t.Fatalf("query mismatch: %q", q)
	}
}

// TestWhereTenant_FromAppend verifies the From(...) tail is preserved
// between the WHERE fragment and the ORDER BY tail.
func TestWhereTenant_FromAppend(t *testing.T) {
	b := WhereTenant("t-1", "status = ?", "active").
		From("widgets").
		OrderBy("id")
	q, err := b.String()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := "WHERE tenant_id = $1 AND status = $2 FROM widgets ORDER BY id"
	if q != want {
		t.Fatalf("query mismatch\n got: %q\nwant: %q", q, want)
	}
}

// TestWhereTenant_Count returns the fully qualified SELECT COUNT(*) SQL
// for the caller to hand to a DB handle.
func TestWhereTenant_Count(t *testing.T) {
	b := WhereTenant("t-1", "status = ?", "active")
	q, args := b.Count("widgets")
	if q != "SELECT COUNT(*) FROM widgets WHERE tenant_id = $1 AND status = $2" {
		t.Fatalf("count query mismatch: %q", q)
	}
	want := []any{"t-1", "active"}
	if !reflect.DeepEqual(args, want) {
		t.Fatalf("args mismatch: %#v", args)
	}
}

// TestWhereTenant_Count_EmptyTenantFailsClosed asserts the count helper
// also fails closed on empty tenant.
func TestWhereTenant_Count_EmptyTenantFailsClosed(t *testing.T) {
	b := WhereTenant("")
	q, args := b.Count("widgets")
	if q != "" || args != nil {
		t.Fatalf("expected empty string and nil args, got (%q, %#v)", q, args)
	}
}

// TestWhereTenant_FragmentWithoutPlaceholder verifies fragments that do
// not contain "?" (e.g. "1=1" placeholder predicates) are passed through
// as literals without consuming a $-number.
func TestWhereTenant_FragmentWithoutPlaceholder(t *testing.T) {
	b := WhereTenant("t-1", "1=1", nil, "id = ?", "w-1")
	q, err := b.String()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if q != "WHERE tenant_id = $1 AND 1=1 AND id = $2" {
		t.Fatalf("query mismatch: %q", q)
	}
	args, _ := b.Args()
	want := []any{"t-1", "w-1"} // "1=1" has no arg, so args is [t-1, w-1]
	if !reflect.DeepEqual(args, want) {
		t.Fatalf("args mismatch\n got: %#v\nwant: %#v", args, want)
	}
}

// TestWhereTenant_PairCountMismatchConfirms the builder silently drops
// trailing unpaired fragments (odd-arity) rather than panicking at
// construction time.
func TestWhereTenant_PairCountMismatch(t *testing.T) {
	b := WhereTenant("t-1", "id = ?", "w-1", "unpaired")
	q, err := b.String()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if q != "WHERE tenant_id = $1 AND id = $2" {
		t.Fatalf("query mismatch: %q", q)
	}
}

// TestWhereTenant_WhereOnly verifies Where() returns only the WHERE
// fragment so callers can splice it into a custom SELECT.
func TestWhereTenant_WhereOnly(t *testing.T) {
	b := WhereTenant("t-1", "id = ?", "w-1")
	where, err := b.Where()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if where != "WHERE tenant_id = $1 AND id = $2" {
		t.Fatalf("where mismatch: %q", where)
	}
}

// TestWhereTenant_ChainableConfirms the builder returns itself for all
// tail modifiers so callers can chain fluently.
func TestWhereTenant_Chainable(t *testing.T) {
	b := WhereTenant("t-1", "status = ?", "active")
	if b.OrderBy("x") != b {
		t.Fatal("OrderBy should return the same builder")
	}
	if b.GroupBy("x") != b {
		t.Fatal("GroupBy should return the same builder")
	}
	if b.Having("x > 1") != b {
		t.Fatal("Having should return the same builder")
	}
	if b.Limit(1) != b {
		t.Fatal("Limit should return the same builder")
	}
	if b.Offset(0) != b {
		t.Fatal("Offset should return the same builder")
	}
	if b.From("t") != b {
		t.Fatal("From should return the same builder")
	}
}
