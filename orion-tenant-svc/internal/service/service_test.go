package service

import (
	"testing"
)

func TestGenerateUUID_Uniqueness(t *testing.T) {
	seen := make(map[string]bool)
	for i := 0; i < 1000; i++ {
		id := generateUUID()
		if seen[id] {
			t.Fatalf("duplicate UUID generated: %s", id)
		}
		seen[id] = true
	}
}

func TestGenerateUUID_Format(t *testing.T) {
	id := generateUUID()
	// UUID format: 8-4-4-4-12 hex chars
	if len(id) != 36 {
		t.Errorf("expected 36 chars, got %d: %s", len(id), id)
	}
	if id[8] != '-' || id[13] != '-' || id[18] != '-' || id[23] != '-' {
		t.Errorf("invalid UUID format: %s", id)
	}
}

func TestGenerateUUID_Version(t *testing.T) {
	id := generateUUID()
	// UUID v4: 13th char (index 14) must be '4'
	if id[14] != '4' {
		t.Errorf("expected UUID v4, got version %c in %s", id[14], id)
	}
}

func TestGenerateUUID_Variant(t *testing.T) {
	id := generateUUID()
	// UUID variant 1: 17th char (index 19) must be 8, 9, a, or b
	c := id[19]
	if c != '8' && c != '9' && c != 'a' && c != 'b' {
		t.Errorf("expected variant 1 (8/9/a/b), got %c in %s", c, id)
	}
}
