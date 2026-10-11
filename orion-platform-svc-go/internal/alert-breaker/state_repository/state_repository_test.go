package state_repository

import (
	"context"
	"errors"
	"testing"
	"time"

	"orion/platform-svc-go/internal/common/alertlock"
)

func TestNewRepository_DefaultsToSerializableAndFiveSeconds(t *testing.T) {
	r := NewRepository(nil, alertlock.Options{})
	if r.opts.Isolation != alertlock.DefaultIsolation {
		t.Errorf("default isolation = %v, want Serializable", r.opts.Isolation)
	}
	if r.opts.Timeout != alertlock.DefaultTimeout {
		t.Errorf("default timeout = %v, want 5s", r.opts.Timeout)
	}
}

func TestNewRepository_KeepsCustomOptions(t *testing.T) {
	custom := alertlock.Options{
		Isolation: alertlock.DefaultIsolation,
		Timeout:   10 * time.Second,
	}
	r := NewRepository(nil, custom)
	if r.opts.Timeout != 10*time.Second {
		t.Errorf("custom timeout should be preserved, got %v", r.opts.Timeout)
	}
}

func TestNewRepository_NilDBAllowed(t *testing.T) {
	// We don't fail on nil db at construction — it's checked per-method.
	r := NewRepository(nil, alertlock.Options{})
	if r == nil {
		t.Fatal("NewRepository should not return nil")
	}
}

func TestUpsertBreakerState_NilDBReturnsError(t *testing.T) {
	r := NewRepository(nil, alertlock.Options{})
	_, err := r.UpsertBreakerState(context.Background(), "t", 1, "k", 1, "fp", nil, nil)
	if err == nil {
		t.Error("expected error for nil db")
	}
}

func TestGetByUniqueKey_NilDBReturnsError(t *testing.T) {
	r := NewRepository(nil, alertlock.Options{})
	_, err := r.GetByUniqueKey(context.Background(), "t", 1, "k")
	if err == nil {
		t.Error("expected error for nil db")
	}
}

func TestExpireAndCleanup_NilDBReturnsError(t *testing.T) {
	r := NewRepository(nil, alertlock.Options{})
	_, err := r.ExpireAndCleanup(context.Background())
	if err == nil {
		t.Error("expected error for nil db")
	}
}

func TestStateFromRow_NilLastFingerprint(t *testing.T) {
	row := &stateRow{
		ID:        1,
		TenantID:  "t",
		PolicyID:  100,
		UniqueKey: "k",
		Count:     5,
		Version:   3,
	}
	s := stateFromRow(row)
	if s.LastFingerprint != "" {
		t.Errorf("nil last_fingerprint should map to empty string, got %q", s.LastFingerprint)
	}
	if s.Count != 5 || s.Version != 3 {
		t.Errorf("Count/Version not preserved: %d, %d", s.Count, s.Version)
	}
}

func TestStateFromRow_NonNilLastFingerprint(t *testing.T) {
	fp := "abc123"
	row := &stateRow{
		ID:              1,
		TenantID:        "t",
		PolicyID:        100,
		UniqueKey:       "k",
		Count:           5,
		LastFingerprint: &fp,
		Version:         3,
	}
	s := stateFromRow(row)
	if s.LastFingerprint != fp {
		t.Errorf("LastFingerprint = %q, want %q", s.LastFingerprint, fp)
	}
}

func TestStateFromRow_WindowPointersPreserved(t *testing.T) {
	start := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	end := start.Add(time.Hour)
	row := &stateRow{
		ID:          1,
		WindowStart: &start,
		WindowEnd:   &end,
	}
	s := stateFromRow(row)
	if s.WindowStart == nil || !s.WindowStart.Equal(start) {
		t.Errorf("WindowStart = %v, want %v", s.WindowStart, start)
	}
	if s.WindowEnd == nil || !s.WindowEnd.Equal(end) {
		t.Errorf("WindowEnd = %v, want %v", s.WindowEnd, end)
	}
}

func TestErrNoState_Message(t *testing.T) {
	if ErrNoState == nil {
		t.Error("ErrNoState should not be nil")
	}
	if !errors.Is(ErrNoState, ErrNoState) {
		t.Error("errors.Is(ErrNoState, ErrNoState) should be true")
	}
}

func TestSelectStateSQL_HasForUpdateCompatibleShape(t *testing.T) {
	// The SQL should be a SELECT with a WHERE clause on (tenant_id, policy_id, unique_key).
	// We don't have a DB to execute it, but we can check the string.
	if selectStateSQL == "" {
		t.Error("selectStateSQL should not be empty")
	}
	// Basic structural checks.
	if !contains(selectStateSQL, "FROM alert_breaker_state") {
		t.Error("selectStateSQL should query alert_breaker_state")
	}
	if !contains(selectStateSQL, "$1") || !contains(selectStateSQL, "$2") || !contains(selectStateSQL, "$3") {
		t.Error("selectStateSQL should have 3 positional params")
	}
}

func contains(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
