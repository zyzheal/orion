package repository

import (
	"testing"
)

func Test_NewRepository_Nil(t *testing.T) {
	r := NewRepository(nil)
	if r == nil {
		t.Fatal("expected non-nil repository")
	}
	if r.db != nil {
		t.Fatal("expected nil db when constructed with nil")
	}
}

func Test_joinComma(t *testing.T) {
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
		got := joinComma(tt.in)
		if got != tt.out {
			t.Fatalf("joinComma(%v) = %q, want %q", tt.in, got, tt.out)
		}
	}
}
