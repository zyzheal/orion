package repository

import (
	"testing"
)

func Test_NewRepository_Nil(t *testing.T) {
	r := NewRepository(nil)
	if r == nil {
		t.Fatal("expected non-nil repository")
	}
}

func Test_joinStrings(t *testing.T) {
	tests := []struct {
		in  []string
		sep string
		out string
	}{
		{nil, ",", ""},
		{[]string{}, ",", ""},
		{[]string{"a"}, ",", "a"},
		{[]string{"a", "b"}, ",", "a,b"},
		{[]string{"a", "b", "c"}, " AND ", "a AND b AND c"},
	}
	for _, tt := range tests {
		got := joinStrings(tt.in, tt.sep)
		if got != tt.out {
			t.Fatalf("joinStrings(%v, %q) = %q, want %q", tt.in, tt.sep, got, tt.out)
		}
	}
}

func Test_toMapStringString_Nil(t *testing.T) {
	m := toMapStringString(nil)
	if m != nil {
		t.Fatalf("toMapStringString(nil) = %v, want nil", m)
	}
}

func Test_toMapStringString_StringValues(t *testing.T) {
	input := map[string]interface{}{
		"host": "localhost",
		"port": "8080",
	}
	m := toMapStringString(input)
	if len(m) != 2 {
		t.Fatalf("len = %d, want 2", len(m))
	}
	if m["host"] != "localhost" {
		t.Fatalf("m[host] = %q, want %q", m["host"], "localhost")
	}
	if m["port"] != "8080" {
		t.Fatalf("m[port] = %q, want %q", m["port"], "8080")
	}
}

func Test_toMapStringString_NonStringValues(t *testing.T) {
	input := map[string]interface{}{
		"count": 42,
		"ratio": 3.14,
	}
	m := toMapStringString(input)
	if len(m) != 2 {
		t.Fatalf("len = %d, want 2", len(m))
	}
	if m["count"] == "" {
		t.Fatal("m[count] should be non-empty")
	}
	if m["ratio"] == "" {
		t.Fatal("m[ratio] should be non-empty")
	}
}

func Test_Errors(t *testing.T) {
	if ErrNotFound == nil {
		t.Fatal("ErrNotFound should not be nil")
	}
	if ErrDuplicate == nil {
		t.Fatal("ErrDuplicate should not be nil")
	}
}
