package repository

import (
	"context"
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

func Test_NotYetImplemented(t *testing.T) {
	err := NotYetImplemented("feature X")
	if err == nil {
		t.Fatal("expected non-nil error")
	}
	if err.Error() != "feature X" {
		t.Fatalf("error = %q, want %q", err.Error(), "feature X")
	}
}

func Test_HealthCheckAlways(t *testing.T) {
	r := NewRepository(nil)
	ok, err := r.HealthCheckAlways(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !ok {
		t.Fatal("expected HealthCheckAlways to return true")
	}
}
