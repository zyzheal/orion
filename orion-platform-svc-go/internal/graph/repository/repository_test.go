package repository

import (
	"testing"
	"time"
)

func Test_NewGraphNodeRepository_Nil(t *testing.T) {
	r := NewGraphNodeRepository(nil)
	if r == nil {
		t.Fatal("expected non-nil repository")
	}
}

func Test_NewGraphRelationshipRepository_Nil(t *testing.T) {
	r := NewGraphRelationshipRepository(nil)
	if r == nil {
		t.Fatal("expected non-nil repository")
	}
}

func Test_toString_Nil(t *testing.T) {
	if toString(nil) != "" {
		t.Fatalf("toString(nil) = %q, want empty", toString(nil))
	}
}

func Test_toString_String(t *testing.T) {
	s := "hello"
	if toString(s) != "hello" {
		t.Fatalf("toString(%q) = %q, want %q", s, toString(s), "hello")
	}
}

func Test_toString_Bytes(t *testing.T) {
	b := []byte("bytes")
	if toString(b) != "bytes" {
		t.Fatalf("toString([]byte(%q)) = %q, want %q", "bytes", toString(b), "bytes")
	}
}

func Test_toString_Int(t *testing.T) {
	if toString(42) != "42" {
		t.Fatalf("toString(42) = %q, want %q", toString(42), "42")
	}
}

func Test_toTime_Nil(t *testing.T) {
	t0 := toTime(nil)
	if !t0.IsZero() {
		t.Fatalf("toTime(nil) = %v, want zero time", t0)
	}
}

func Test_toTime_Time(t *testing.T) {
	now := time.Now().UTC()
	got := toTime(now)
	if !got.Equal(now) {
		t.Fatalf("toTime(%v) = %v, want %v", now, got, now)
	}
}

func Test_toTime_String_Valid(t *testing.T) {
	ts := "2024-01-15 10:30:45"
	got := toTime(ts)
	if got.IsZero() {
		t.Fatal("toTime(valid string) should not be zero")
	}
	if got.Year() != 2024 || got.Month() != 1 || got.Day() != 15 {
		t.Fatalf("toTime(%q) = %v, expected 2024-01-15", ts, got)
	}
}

func Test_toTime_String_Invalid(t *testing.T) {
	got := toTime("not-a-time")
	if !got.IsZero() {
		t.Fatalf("toTime(%q) = %v, want zero time", "not-a-time", got)
	}
}

func Test_rowToNode_NilLabels(t *testing.T) {
	r := NewGraphNodeRepository(nil)
	node := r.rowToNode(map[string]interface{}{
		"id":        "node-1",
		"tenant_id": "t1",
	})
	if node == nil {
		t.Fatal("rowToNode returned nil")
	}
	if node.ID != "node-1" {
		t.Fatalf("node.ID = %q, want %q", node.ID, "node-1")
	}
	if node.TenantID != "t1" {
		t.Fatalf("node.TenantID = %q, want %q", node.TenantID, "t1")
	}
	if node.Labels != "" {
		t.Fatalf("node.Labels = %q, want empty", node.Labels)
	}
	if len(node.Properties) != 0 {
		t.Fatalf("node.Properties should be empty, got %v", node.Properties)
	}
}

func Test_rowToRel_NilProperties(t *testing.T) {
	r := NewGraphRelationshipRepository(nil)
	rel := r.rowToRel(map[string]interface{}{
		"id":            "rel-1",
		"tenant_id":     "t1",
		"type":          "HAS_CHILD",
		"start_node_id": "s1",
		"end_node_id":   "e1",
	})
	if rel == nil {
		t.Fatal("rowToRel returned nil")
	}
	if rel.ID != "rel-1" {
		t.Fatalf("rel.ID = %q, want %q", rel.ID, "rel-1")
	}
	if rel.Type != "HAS_CHILD" {
		t.Fatalf("rel.Type = %q, want %q", rel.Type, "HAS_CHILD")
	}
	if rel.StartNodeID != "s1" {
		t.Fatalf("rel.StartNodeID = %q, want %q", rel.StartNodeID, "s1")
	}
	if rel.EndNodeID != "e1" {
		t.Fatalf("rel.EndNodeID = %q, want %q", rel.EndNodeID, "e1")
	}
	if len(rel.Properties) != 0 {
		t.Fatalf("rel.Properties should be empty, got %v", rel.Properties)
	}
}
