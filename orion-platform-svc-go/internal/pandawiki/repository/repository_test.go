package repository

import (
	"testing"

	"orion/platform-svc-go/internal/pandawiki/models"
)

func Test_NewRepository_Nil(t *testing.T) {
	r := NewRepository(nil)
	if r == nil {
		t.Fatal("expected non-nil repository")
	}
}

func Test_buildSpaceWhere_NoOpts(t *testing.T) {
	clause, args := buildSpaceWhere("tenant-1", nil)
	if clause != "tenant_id = $1" {
		t.Fatalf("clause = %q, want %q", clause, "tenant_id = $1")
	}
	if len(args) != 1 {
		t.Fatalf("args len = %d, want 1", len(args))
	}
	if args[0] != "tenant-1" {
		t.Fatalf("args[0] = %q, want %q", args[0], "tenant-1")
	}
}

func Test_buildSpaceWhere_TypeFilter(t *testing.T) {
	tType := "project"
	opts := &ListSpacesOpts{Type: &tType}
	clause, args := buildSpaceWhere("t1", opts)
	if clause != "tenant_id = $1 AND type = $2" {
		t.Fatalf("clause = %q, want %q", clause, "tenant_id = $1 AND type = $2")
	}
	if len(args) != 2 {
		t.Fatalf("args len = %d, want 2", len(args))
	}
}

func Test_buildSpaceWhere_SearchFilter(t *testing.T) {
	empty := ""
	opts := &ListSpacesOpts{Type: &empty, Search: strPtr("wiki")}
	clause, args := buildSpaceWhere("t1", opts)
	if clause != "tenant_id = $1 AND (name ILIKE $2 OR description ILIKE $2)" {
		t.Fatalf("clause = %q", clause)
	}
	if len(args) != 2 {
		t.Fatalf("args len = %d, want 2", len(args))
	}
	if args[1] != "%wiki%" {
		t.Fatalf("args[1] = %q, want %q", args[1], "%wiki%")
	}
}

func Test_buildDocWhere_NoOpts(t *testing.T) {
	clause, args := buildDocWhere("t1", nil)
	if clause != "tenant_id = $1" {
		t.Fatalf("clause = %q, want %q", clause, "tenant_id = $1")
	}
	if len(args) != 1 {
		t.Fatalf("args len = %d, want 1", len(args))
	}
}

func Test_buildDocWhere_StatusFilter(t *testing.T) {
	status := "published"
	opts := &ListDocsOpts{Status: &status}
	clause, args := buildDocWhere("t1", opts)
	if clause != "tenant_id = $1 AND status = $2" {
		t.Fatalf("clause = %q", clause)
	}
	if len(args) != 2 {
		t.Fatalf("args len = %d, want 2", len(args))
	}
}
func Test_buildDocWhere_TagFilter(t *testing.T) {
	tag := "go"
	opts := &ListDocsOpts{Tag: &tag}
	clause, _ := buildDocWhere("t1", opts)
	expected := "tenant_id = $1 AND $2 = ANY(tags)"
	if clause != expected {
		t.Fatalf("clause = %q, want %q", clause, expected)
	}
}

func Test_buildDocWhere_SearchFilter(t *testing.T) {
	search := "kubernetes"
	opts := &ListDocsOpts{Search: &search}
	clause, args := buildDocWhere("t1", opts)
	if clause != "tenant_id = $1 AND (title ILIKE $2 OR content ILIKE $2)" {
		t.Fatalf("clause = %q", clause)
	}
	if len(args) != 2 {
		t.Fatalf("args len = %d, want 2", len(args))
	}
	if args[1] != "%kubernetes%" {
		t.Fatalf("args[1] = %q, want %q", args[1], "%kubernetes%")
	}
}

func Test_buildSearchWhere_NoSpaceID(t *testing.T) {
	clause, args := buildSearchWhere("t1", "hello", nil)
	if clause != "tenant_id = $1 AND status = 'published' AND (title ILIKE $2 OR content ILIKE $2)" {
		t.Fatalf("clause = %q", clause)
	}
	if len(args) != 2 {
		t.Fatalf("args len = %d, want 2", len(args))
	}
	if args[1] != "%hello%" {
		t.Fatalf("args[1] = %q, want %q", args[1], "%hello%")
	}
}

func Test_buildSearchWhere_WithSpaceID(t *testing.T) {
	spaceID := "sp1"
	clause, args := buildSearchWhere("t1", "world", &spaceID)
	if clause != "tenant_id = $1 AND status = 'published' AND (title ILIKE $2 OR content ILIKE $2) AND space_id = $3" {
		t.Fatalf("clause = %q", clause)
	}
	if len(args) != 3 {
		t.Fatalf("args len = %d, want 3", len(args))
	}
}

func Test_buildSpaceSet_EmptyFields(t *testing.T) {
	// All fields are nil -- buildSpaceSet should produce no SET clauses.
	input := &models.UpdateSpaceInput{}
	set, args, n := buildSpaceSet(input)
	if set != "" {
		t.Fatalf("set = %q, want empty", set)
	}
	if len(args) != 0 {
		t.Fatalf("args len = %d, want 0", len(args))
	}
	if n != 0 {
		t.Fatalf("n = %d, want 0", n)
	}
}

func Test_joinStrings(t *testing.T) {
	tests := []struct {
		parts []string
		sep   string
		out   string
	}{
		{nil, ",", ""},
		{[]string{}, ",", ""},
		{[]string{"a"}, ",", "a"},
		{[]string{"a", "b"}, ",", "a,b"},
		{[]string{"a", "b", "c"}, ", ", "a, b, c"},
	}
	for _, tt := range tests {
		got := joinStrings(tt.parts, tt.sep)
		if got != tt.out {
			t.Fatalf("joinStrings(%v, %q) = %q, want %q", tt.parts, tt.sep, got, tt.out)
		}
	}
}

func strPtr(s string) *string {
	return &s
}
