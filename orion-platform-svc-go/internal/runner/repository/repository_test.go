package repository

import (
	"errors"
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

func Test_Errors(t *testing.T) {
	if ErrNotFound == nil {
		t.Fatal("ErrNotFound should not be nil")
	}
	if ErrDuplicate == nil {
		t.Fatal("ErrDuplicate should not be nil")
	}
	if ErrNotFound.Error() == "" {
		t.Fatal("ErrNotFound should have a non-empty error message")
	}
	if ErrDuplicate.Error() != "duplicate key" {
		t.Fatalf("ErrDuplicate = %q, want %q", ErrDuplicate.Error(), "duplicate key")
	}
}

func Test_ErrNotFound_Is(t *testing.T) {
	if !errors.Is(ErrNotFound, ErrNotFound) {
		t.Fatal("errors.Is(ErrNotFound, ErrNotFound) should be true")
	}
	if errors.Is(ErrNotFound, ErrDuplicate) {
		t.Fatal("errors.Is(ErrNotFound, ErrDuplicate) should be false")
	}
}
