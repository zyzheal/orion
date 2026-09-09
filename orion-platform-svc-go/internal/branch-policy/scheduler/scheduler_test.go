package scheduler

import (
	"context"
	"testing"
	"time"

	"orion/platform-svc-go/internal/branch-policy/models"
)

// stubSvc is a minimal SyncPolicyService stub for scheduler tests.
type stubSvc struct {
	policies []models.SyncPolicy
	calls    []string // policy IDs that had RunNow called
}

func (s *stubSvc) GetEnabledPolicies(ctx context.Context, tenantID string, cronMatch func(string) bool) ([]models.SyncPolicy, error) {
	out := make([]models.SyncPolicy, 0, len(s.policies))
	for _, p := range s.policies {
		if p.CronExpr == "" || cronMatch(p.CronExpr) {
			out = append(out, p)
		}
	}
	return out, nil
}

func (s *stubSvc) RunNow(ctx context.Context, tenantID, id, actor, sourceCommit string) (*models.SyncRunLog, error) {
	s.calls = append(s.calls, id)
	return &models.SyncRunLog{ID: "sl-1", PolicyID: id, Status: models.SyncStatusSuccess}, nil
}

func TestScheduler_TickOnce_NoPolicies(t *testing.T) {
	svc := &stubSvc{}
	s := &Scheduler{Now: func() time.Time { return time.Date(2026, 8, 26, 3, 0, 0, 0, time.UTC) }}
	s.TickOnce(context.Background(), svc)
	if len(svc.calls) != 0 {
		t.Fatalf("expected 0 calls, got %d", len(svc.calls))
	}
}

func TestScheduler_TickOnce_MatchesCron(t *testing.T) {
	now := time.Date(2026, 8, 26, 3, 0, 0, 0, time.UTC)
	svc := &stubSvc{policies: []models.SyncPolicy{
		{ID: "sp-1", TenantID: "t1", CronExpr: "0 3 * * *", Frequency: models.SyncFrequencyDaily},
	}}
	s := &Scheduler{Now: func() time.Time { return now }}
	s.TickOnce(context.Background(), svc)
	if len(svc.calls) != 1 || svc.calls[0] != "sp-1" {
		t.Fatalf("expected sp-1 to run, got %v", svc.calls)
	}
}

func TestScheduler_TickOnce_SkipsWhenCronDoesNotMatch(t *testing.T) {
	now := time.Date(2026, 8, 26, 3, 0, 0, 0, time.UTC)
	svc := &stubSvc{policies: []models.SyncPolicy{
		{ID: "sp-1", TenantID: "t1", CronExpr: "0 4 * * *", Frequency: models.SyncFrequencyDaily},
	}}
	s := &Scheduler{Now: func() time.Time { return now }}
	s.TickOnce(context.Background(), svc)
	if len(svc.calls) != 0 {
		t.Fatalf("expected 0 calls (cron mismatch), got %v", svc.calls)
	}
}

func TestScheduler_TickOnce_EmptyCronFallsBack(t *testing.T) {
	now := time.Date(2026, 8, 26, 3, 0, 0, 0, time.UTC)
	svc := &stubSvc{policies: []models.SyncPolicy{
		// No CronExpr — should run (frequency-based fallback).
		{ID: "sp-1", TenantID: "t1", Frequency: models.SyncFrequencyDaily},
	}}
	s := &Scheduler{Now: func() time.Time { return now }}
	s.TickOnce(context.Background(), svc)
	if len(svc.calls) != 1 {
		t.Fatalf("expected 1 call (empty cron matches), got %v", svc.calls)
	}
}

func TestScheduler_TickOnce_RespectsMinInterval(t *testing.T) {
	now := time.Date(2026, 8, 26, 3, 0, 0, 0, time.UTC)
	lastRun := now.Add(-10 * time.Minute) // just ran 10 minutes ago
	svc := &stubSvc{policies: []models.SyncPolicy{
		{ID: "sp-1", TenantID: "t1", CronExpr: "0 3 * * *", Frequency: models.SyncFrequencyDaily, LastRunAt: &lastRun},
	}}
	s := &Scheduler{Now: func() time.Time { return now }}
	s.TickOnce(context.Background(), svc)
	if len(svc.calls) != 0 {
		t.Fatalf("expected 0 calls (min interval not met), got %v", svc.calls)
	}
}

func TestScheduler_TickOnce_AllowsRunAfterMinInterval(t *testing.T) {
	now := time.Date(2026, 8, 26, 3, 0, 0, 0, time.UTC)
	lastRun := now.Add(-25 * time.Hour) // ran yesterday
	svc := &stubSvc{policies: []models.SyncPolicy{
		{ID: "sp-1", TenantID: "t1", CronExpr: "0 3 * * *", Frequency: models.SyncFrequencyDaily, LastRunAt: &lastRun},
	}}
	s := &Scheduler{Now: func() time.Time { return now }}
	s.TickOnce(context.Background(), svc)
	if len(svc.calls) != 1 {
		t.Fatalf("expected 1 call (min interval met), got %v", svc.calls)
	}
}

func TestScheduler_MinIntervalForFrequency(t *testing.T) {
	cases := []struct {
		f    models.SyncFrequency
		want time.Duration
	}{
		{models.SyncFrequencyDaily, 24 * time.Hour},
		{models.SyncFrequencyWeekly, 7 * 24 * time.Hour},
		{models.SyncFrequencyMonthly, 30 * 24 * time.Hour},
		{models.SyncFrequency("unknown"), time.Hour},
	}
	for _, c := range cases {
		if got := MinIntervalForFrequency(c.f); got != c.want {
			t.Fatalf("MinIntervalForFrequency(%v)=%v, want %v", c.f, got, c.want)
		}
	}
}

func TestCronFieldMatches(t *testing.T) {
	cases := []struct {
		field string
		v     int
		want  bool
	}{
		{"*", 5, true},
		{"5", 5, true},
		{"5", 6, false},
		{"3,5", 5, true},
		{"3,5", 4, false},
		{"3-7", 5, true},
		{"3-7", 8, false},
		{"*/5", 10, true},
		{"*/5", 11, false},
		{"invalid", 5, false},
		{"", 5, false},
	}
	for _, c := range cases {
		if got := cronFieldMatches(c.field, c.v); got != c.want {
			t.Fatalf("cronFieldMatches(%q,%d)=%v, want %v", c.field, c.v, got, c.want)
		}
	}
}

func TestCronMatch_Malformed(t *testing.T) {
	now := time.Now()
	m := TickCronExprMatches(now)
	// Only 3 fields -> malformed -> no match.
	if m("0 3 0") {
		t.Fatalf("expected malformed to not match")
	}
	if m("") {
		t.Fatalf("expected empty to not match")
	}
}

func TestScheduler_Start_Cancel(t *testing.T) {
	svc := &stubSvc{}
	s := &Scheduler{Tick: 50 * time.Millisecond}
	cancel := s.Start(context.Background(), svc)
	cancel()
	// Should not panic. Wait briefly and confirm no runaway goroutine.
	time.Sleep(10 * time.Millisecond)
}
