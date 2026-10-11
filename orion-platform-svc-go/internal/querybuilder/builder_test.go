package querybuilder

import (
	"context"
	"errors"
	"strings"
	"testing"
)

func TestTenantFromContext_Empty(t *testing.T) {
	if TenantFromContext(context.Background()) != "" {
		t.Fatal("expected empty for empty ctx")
	}
}

func TestTenantFromContext_Nil(t *testing.T) {
	if TenantFromContext(nil) != "" {
		t.Fatal("expected empty for nil ctx")
	}
}

func TestWithTenantContext(t *testing.T) {
	ctx := WithTenantContext(context.Background(), "t-1")
	if got := TenantFromContext(ctx); got != "t-1" {
		t.Fatalf("expected t-1, got %q", got)
	}
}

func TestNew_EmptyTable(t *testing.T) {
	if New("") != nil {
		t.Error("expected nil for empty table")
	}
	if New("   ") != nil {
		t.Error("expected nil for whitespace table")
	}
}

func TestNew_ValidTable(t *testing.T) {
	b := New("users")
	if b == nil {
		t.Fatal("expected non-nil")
	}
	if b.Table() != "users" {
		t.Errorf("Table mismatch: %q", b.Table())
	}
}

func TestBuilder_NilBuilder_WithTenant(t *testing.T) {
	var b *Builder
	if _, err := b.WithTenant(context.Background()); !errors.Is(err, ErrNilBuilder) {
		t.Errorf("expected ErrNilBuilder, got %v", err)
	}
}

func TestBuilder_WithTenant_MissingTenantID(t *testing.T) {
	b := New("users")
	_, err := b.WithTenant(context.Background())
	if !errors.Is(err, ErrMissingTenantFilter) {
		t.Errorf("expected ErrMissingTenantFilter, got %v", err)
	}
}

func TestBuilder_WithTenant_Success(t *testing.T) {
	ctx := WithTenantContext(context.Background(), "t-1")
	b := New("users")
	if _, err := b.WithTenant(ctx); err != nil {
		t.Fatalf("WithTenant failed: %v", err)
	}
	if b.ArgsLen() != 1 {
		t.Errorf("ArgsLen should be 1, got %d", b.ArgsLen())
	}
	if b.Args()[0] != "t-1" {
		t.Errorf("Args()[0] should be t-1, got %v", b.Args()[0])
	}
}

func TestBuilder_Where_Valid(t *testing.T) {
	ctx := WithTenantContext(context.Background(), "t-1")
	b := New("users")
	b.WithTenant(ctx)
	b.Where("name", "=", "alice")

	where, args, err := b.BuildWhere()
	if err != nil {
		t.Fatalf("BuildWhere failed: %v", err)
	}
	if !strings.Contains(where, "tenant_id = $1") {
		t.Errorf("missing tenant_id in WHERE: %s", where)
	}
	if !strings.Contains(where, "name = $2") {
		t.Errorf("missing name in WHERE: %s", where)
	}
	if len(args) != 2 || args[0] != "t-1" || args[1] != "alice" {
		t.Errorf("args mismatch: %v", args)
	}
}

func TestBuilder_Where_InvalidOp(t *testing.T) {
	b := New("users")
	_, err := b.Where("name", "LIKE", "%a%")
	if err == nil {
		t.Error("expected error for invalid op")
	}
}

func TestBuilder_WhereIn(t *testing.T) {
	ctx := WithTenantContext(context.Background(), "t-1")
	b := New("users")
	b.WithTenant(ctx)
	b.WhereIn("id", []any{1, 2, 3})

	where, args, err := b.BuildWhere()
	if err != nil {
		t.Fatalf("BuildWhere failed: %v", err)
	}
	if !strings.Contains(where, "id IN ($2, $3, $4)") {
		t.Errorf("WHERE should contain IN clause: %s", where)
	}
	if len(args) != 4 {
		t.Errorf("args should have 4 entries, got %d", len(args))
	}
}

func TestBuilder_WhereIn_Empty(t *testing.T) {
	b := New("users")
	_, err := b.WhereIn("id", nil)
	if err == nil {
		t.Error("expected error for empty vals")
	}
}

func TestBuilder_BuildWhere_NoConditions(t *testing.T) {
	b := New("users")
	_, _, err := b.BuildWhere()
	if !errors.Is(err, ErrMissingTenantFilter) {
		t.Errorf("expected ErrMissingTenantFilter, got %v", err)
	}
}

func TestBuilder_BuildWhere_MissingTenant(t *testing.T) {
	b := New("users")
	b.Where("name", "=", "alice")
	_, _, err := b.BuildWhere()
	if !errors.Is(err, ErrMissingTenantFilter) {
		t.Errorf("expected ErrMissingTenantFilter, got %v", err)
	}
}

func TestBuilder_BuildSelect(t *testing.T) {
	ctx := WithTenantContext(context.Background(), "t-1")
	b := New("users")
	b.WithTenant(ctx)
	b.Where("active", "=", true)
	b.OrderBy("created_at DESC")
	b.Limit(10)
	b.Offset(5)

	q, args, err := b.BuildSelect()
	if err != nil {
		t.Fatalf("BuildSelect failed: %v", err)
	}
	if !strings.HasPrefix(q, "SELECT * FROM users WHERE ") {
		t.Errorf("query should start with SELECT: %s", q)
	}
	if !strings.Contains(q, "ORDER BY created_at DESC") {
		t.Errorf("missing ORDER BY: %s", q)
	}
	if !strings.Contains(q, "LIMIT 10") {
		t.Errorf("missing LIMIT 10: %s", q)
	}
	if !strings.Contains(q, "OFFSET 5") {
		t.Errorf("missing OFFSET 5: %s", q)
	}
	if len(args) != 2 {
		t.Errorf("args should have 2 entries, got %d", len(args))
	}
}

func TestBuilder_Limit_Negative(t *testing.T) {
	ctx := WithTenantContext(context.Background(), "t-1")
	b := New("users")
	b.WithTenant(ctx)
	b.Limit(-1)
	q, _, err := b.BuildSelect()
	if err != nil {
		t.Fatalf("BuildSelect failed: %v", err)
	}
	if strings.Contains(q, "LIMIT") {
		t.Errorf("negative limit should be ignored: %s", q)
	}
}

func TestBuilder_Table_Empty(t *testing.T) {
	var b *Builder
	if b.Table() != "" {
		t.Error("nil builder Table() should be empty")
	}
}

func TestBuilder_BuildSelect_NilBuilder(t *testing.T) {
	var b *Builder
	_, _, err := b.BuildSelect()
	if !errors.Is(err, ErrNilBuilder) {
		t.Errorf("expected ErrNilBuilder, got %v", err)
	}
}
