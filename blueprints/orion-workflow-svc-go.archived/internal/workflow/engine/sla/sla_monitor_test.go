package sla

import (
	"context"
	"testing"
	"time"
)

func TestSLAMonitor_RegisterAndGet(t *testing.T) {
	monitor := NewSLAMonitor(10 * time.Millisecond)
	rec := &SLARecord{
		ID:       "r-1",
		TicketID: "t-1",
		TaskID:   "task-1",
	}

	monitor.Register(rec)

	found, ok := monitor.GetRecord("t-1")
	if !ok {
		t.Fatal("expected record to be found")
	}
	if found.TicketID != "t-1" {
		t.Errorf("expected ticket t-1, got %s", found.TicketID)
	}

	monitor.Unregister("t-1")
	_, ok = monitor.GetRecord("t-1")
	if ok {
		t.Error("expected record to be removed")
	}
}

func TestSLAMonitor_CheckBreaches(t *testing.T) {
	monitor := NewSLAMonitor(10 * time.Millisecond)

	// Register a record that has already breached
	now := time.Now()
	rec := &SLARecord{
		ID:                   "r-1",
		TicketID:             "t-breach",
		AssignedAt:           now.Add(-2 * time.Hour),
		ResponseDeadlineAt:   now.Add(-1 * time.Hour),
		ResolutionDeadlineAt: now.Add(-30 * time.Minute),
	}
	monitor.Register(rec)

	result, err := monitor.CheckBreaches(context.Background())
	if err != nil {
		t.Fatalf("CheckBreaches returned error: %v", err)
	}
	if len(result.Breached) != 1 {
		t.Fatalf("expected 1 breach, got %d", len(result.Breached))
	}
	if result.Breached[0].Record.BreachType != "resolution" {
		t.Errorf("expected resolution breach, got %s", result.Breached[0].Record.BreachType)
	}
}

func TestSLAMonitor_AtRisk(t *testing.T) {
	monitor := NewSLAMonitor(10 * time.Millisecond)
	now := time.Now()

	// Register a record that is at 80% (at-risk)
	rec := &SLARecord{
		ID:                   "r-2",
		TicketID:             "t-risk",
		AssignedAt:           now.Add(-4 * time.Hour),
		ResponseDeadlineAt:   now.Add(4 * time.Hour),
		ResolutionDeadlineAt: now.Add(1 * time.Hour), // 1h remaining, 5h total = 80%
	}
	monitor.Register(rec)

	result, err := monitor.CheckBreaches(context.Background())
	if err != nil {
		t.Fatalf("CheckBreaches returned error: %v", err)
	}
	if len(result.AtRisk) == 0 {
		t.Error("expected at-risk record")
	}
}

func TestSLAMonitor_UpdateRatio(t *testing.T) {
	monitor := NewSLAMonitor(10 * time.Millisecond)
	now := time.Now()

	rec := &SLARecord{
		AssignedAt:           now.Add(-3 * time.Hour),
		ResolutionDeadlineAt: now.Add(3 * time.Hour), // 6h total, 3h elapsed = 0.5
	}
	monitor.UpdateRatio(rec, now)

	if rec.UtilizedRatio != 0.5 {
		t.Errorf("expected ratio 0.5, got %f", rec.UtilizedRatio)
	}
}

func TestSLAMonitor_Run(t *testing.T) {
	monitor := NewSLAMonitor(10 * time.Millisecond)
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()

	count := 0
	callback := func(SLABreachInfo) { count++ }

	err := monitor.Run(ctx, callback)
	if err != context.DeadlineExceeded {
		t.Errorf("expected deadline exceeded, got %v", err)
	}
	// Count may be 0 or more depending on timing; the important part is no crash
}
