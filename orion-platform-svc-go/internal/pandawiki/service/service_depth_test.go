package service

import (
	"testing"

	"orion/platform-svc-go/internal/pandawiki/models"
)

// ---------------------------------------------------------------------------
// nodeExists — used by GetGraph to avoid duplicating tag nodes
// ---------------------------------------------------------------------------

func TestNodeExistsEmpty(t *testing.T) {
	if nodeExists(nil, "x") {
		t.Error("nil nodes should not contain x")
	}
	if nodeExists([]models.GraphNode{}, "x") {
		t.Error("empty nodes should not contain x")
	}
}

func TestNodeExistsFound(t *testing.T) {
	nodes := []models.GraphNode{
		{ID: "n1"},
		{ID: "n2"},
		{ID: "n3"},
	}
	if !nodeExists(nodes, "n2") {
		t.Error("n2 should be found")
	}
	if nodeExists(nodes, "n4") {
		t.Error("n4 should not be found")
	}
}

func TestNodeExistsDistinctIDs(t *testing.T) {
	nodes := []models.GraphNode{{ID: "a"}}
	if !nodeExists(nodes, "a") {
		t.Error("a should match exactly")
	}
	if nodeExists(nodes, "A") {
		t.Error("comparison should be case-sensitive")
	}
}

// ---------------------------------------------------------------------------
// stringPtr — helper for pointer-to-string
// ---------------------------------------------------------------------------

func TestStringPtrReturnsSameValue(t *testing.T) {
	p := stringPtr("hello")
	if p == nil || *p != "hello" {
		t.Errorf("*p = %v, want hello", p)
	}
}

func TestStringPtrEmptyString(t *testing.T) {
	p := stringPtr("")
	if p == nil || *p != "" {
		t.Errorf("pointer to empty string should be non-nil with empty value")
	}
}

func TestStringPtrDistinctPointers(t *testing.T) {
	p1 := stringPtr("same")
	p2 := stringPtr("same")
	if p1 == p2 {
		t.Error("two calls should return distinct pointers")
	}
	if *p1 != *p2 {
		t.Error("but their values should be equal")
	}
}

// ---------------------------------------------------------------------------
// Sentinel errors
// ---------------------------------------------------------------------------

func TestPandawikiSentinelErrors(t *testing.T) {
	cases := []struct {
		err  error
		want string
	}{
		{ErrNotFound, "not found"},
		{ErrInvalidInput, "invalid input"},
		{ErrConflict, "conflict"},
	}
	for _, tc := range cases {
		if tc.err.Error() != tc.want {
			t.Errorf("%v = %q, want %q", tc.err, tc.err.Error(), tc.want)
		}
	}
	// Each is a distinct error value
	if ErrNotFound == ErrInvalidInput || ErrInvalidInput == ErrConflict {
		t.Error("sentinels must be distinct")
	}
}

// ---------------------------------------------------------------------------
// NewService — construction (does not dereference repo)
// ---------------------------------------------------------------------------

func TestNewServiceWithNilRepo(t *testing.T) {
	s := NewService(nil)
	if s == nil {
		t.Fatal("NewService must return non-nil")
	}
	if s.repo != nil {
		t.Error("nil repo should be stored as nil")
	}
}
