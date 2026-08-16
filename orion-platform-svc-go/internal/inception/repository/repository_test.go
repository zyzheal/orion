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
		{[]string{"a", "b", "c"}, ", ", "a, b, c"},
		{[]string{"x", "y"}, " AND ", "x AND y"},
	}
	for _, tt := range tests {
		got := joinStrings(tt.in, tt.sep)
		if got != tt.out {
			t.Fatalf("joinStrings(%v, %q) = %q, want %q", tt.in, tt.sep, got, tt.out)
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
