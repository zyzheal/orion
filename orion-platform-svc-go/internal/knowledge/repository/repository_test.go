package repository

import (
	"testing"
)

func Test_NewRepository_Nil(t *testing.T) {
	r := NewRepository(nil)
	if r == nil {
		t.Fatal("NewRepository(nil) returned nil")
	}
}

func Test_NewRepository_ReturnsNonNil(t *testing.T) {
	r := NewRepository(nil)
	if r == nil {
		t.Fatal("repo should never be nil")
	}
}

func Test_BuildSpaceQuery_NoFilters(t *testing.T) {
	r := NewRepository(nil)
	sql, args, _ := r.buildSpaceQuery("tenant-1", "", "", 10, 0)
	if sql == "" {
		t.Fatal("sql should not be empty")
	}
	if len(args) != 3 {
		t.Fatalf("args len = %d, want 3 (tenant, limit, offset)", len(args))
	}
	if args[0] != "tenant-1" {
		t.Fatalf("args[0] = %v, want tenant-1", args[0])
	}
}

func Test_BuildSpaceQuery_WithType(t *testing.T) {
	r := NewRepository(nil)
	sql, args, _ := r.buildSpaceQuery("tenant-1", "faq", "", 10, 0)
	if len(args) != 4 {
		t.Fatalf("args len = %d, want 4", len(args))
	}
	if args[1] != "faq" {
		t.Fatalf("args[1] = %v, want 'faq'", args[1])
	}
	if sql == "" {
		t.Fatal("sql should not be empty")
	}
}

func Test_BuildSpaceQuery_WithSearch(t *testing.T) {
	r := NewRepository(nil)
	_, args, _ := r.buildSpaceQuery("tenant-1", "", "test", 10, 0)
	if len(args) != 4 {
		t.Fatalf("args len = %d, want 4", len(args))
	}
	if args[1] != "%test%" {
		t.Fatalf("args[1] = %v, want '%%test%%'", args[1])
	}
}

func Test_BuildSpaceQuery_WithTypeAndSearch(t *testing.T) {
	r := NewRepository(nil)
	_, args, _ := r.buildSpaceQuery("tenant-1", "faq", "test", 10, 0)
	if len(args) != 5 {
		t.Fatalf("args len = %d, want 5", len(args))
	}
}

func Test_BuildSpaceQuery_ArgCountReturned(t *testing.T) {
	r := NewRepository(nil)
	_, _, argCount := r.buildSpaceQuery("tenant-1", "faq", "test", 10, 0)
	if argCount != 3 {
		t.Fatalf("argCount = %d, want 3", argCount)
	}
}

func Test_BuildSpaceQuery_LimitOffset(t *testing.T) {
	r := NewRepository(nil)
	_, args, _ := r.buildSpaceQuery("tenant-1", "", "", 20, 10)
	if len(args) != 3 {
		t.Fatalf("args len = %d, want 3", len(args))
	}
	if args[1] != 20 {
		t.Fatalf("args[1] = %v, want 20", args[1])
	}
}
