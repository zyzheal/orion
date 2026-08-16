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

func Test_joinSet(t *testing.T) {
	tests := []struct {
		in  []string
		out string
	}{
		{nil, ""},
		{[]string{}, ""},
		{[]string{"a"}, "a"},
		{[]string{"a", "b"}, "a, b"},
		{[]string{"a", "b", "c"}, "a, b, c"},
	}
	for _, tt := range tests {
		got := joinSet(tt.in)
		if got != tt.out {
			t.Fatalf("joinSet(%v) = %q, want %q", tt.in, got, tt.out)
		}
	}
}

func Test_NewRepository_ReturnsDistinctPointers(t *testing.T) {
	r1 := NewRepository(nil)
	r2 := NewRepository(nil)
	if r1 == r2 {
		t.Fatal("NewRepository should return distinct pointers")
	}
}
