package scheduler

import (
	"testing"
	"time"
)

func TestComputeNextRunStatic_Daily9AM(t *testing.T) {
	from := time.Date(2026, 1, 1, 8, 0, 0, 0, time.UTC)
	next, err := ComputeNextRunStatic("0 9 * * *", from)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	expected := time.Date(2026, 1, 1, 9, 0, 0, 0, time.UTC)
	if !next.Equal(expected) {
		t.Errorf("expected %v, got %v", expected, next)
	}
}

func TestComputeNextRunStatic_AlreadyPassed(t *testing.T) {
	from := time.Date(2026, 1, 1, 10, 0, 0, 0, time.UTC) // after 9am
	next, err := ComputeNextRunStatic("0 9 * * *", from)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	expected := time.Date(2026, 1, 2, 9, 0, 0, 0, time.UTC) // next day
	if !next.Equal(expected) {
		t.Errorf("expected %v, got %v", expected, next)
	}
}

func TestComputeNextRunStatic_Every5Min(t *testing.T) {
	from := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	next, err := ComputeNextRunStatic("*/5 * * * *", from)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	expected := time.Date(2026, 1, 1, 12, 5, 0, 0, time.UTC)
	if !next.Equal(expected) {
		t.Errorf("expected %v, got %v", expected, next)
	}
}

func TestComputeNextRunStatic_InvalidExpr(t *testing.T) {
	_, err := ComputeNextRunStatic("invalid", time.Now())
	if err == nil {
		t.Fatal("expected error for invalid cron expression")
	}
}

func TestComputeNextRunStatic_Weekly(t *testing.T) {
	// Every Monday at 9am
	from := time.Date(2026, 1, 7, 10, 0, 0, 0, time.UTC) // Wed Jan 7
	next, err := ComputeNextRunStatic("0 9 * * 1", from)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Next Monday after Wed Jan 7 2026 is Jan 12
	expected := time.Date(2026, 1, 12, 9, 0, 0, 0, time.UTC)
	if !next.Equal(expected) {
		t.Errorf("expected %v, got %v", expected, next)
	}
}

func TestComputeNextRunStatic_Monthly(t *testing.T) {
	// 1st of every month at midnight
	from := time.Date(2026, 1, 15, 12, 0, 0, 0, time.UTC)
	next, err := ComputeNextRunStatic("0 0 1 * *", from)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	expected := time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC)
	if !next.Equal(expected) {
		t.Errorf("expected %v, got %v", expected, next)
	}
}
