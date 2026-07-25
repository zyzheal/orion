package engine

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"orion/platform-svc-go/internal/cron/models"
	"orion/platform-svc-go/internal/cron/types"
)

// mockHandler returns "ok" every time.
type mockHandler struct{}

func (mockHandler) Execute(_ context.Context) (string, error) { return "ok", nil }

// flakyHandler fails for n attempts then succeeds.
type flakyHandler struct {
	mu       sync.Mutex
	failures int
	n        int
}

func (h *flakyHandler) Execute(_ context.Context) (string, error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.failures < h.n {
		h.failures++
		return "", errors.New("transient")
	}
	return "recovered", nil
}

// alwaysFailHandler never succeeds.
type alwaysFailHandler struct{}

func (alwaysFailHandler) Execute(_ context.Context) (string, error) { return "", errors.New("fatal") }

// slowHandler sleeps longer than the timeout.
type slowHandler struct {
	d time.Duration
}

func (h slowHandler) Execute(ctx context.Context) (string, error) {
	select {
	case <-time.After(h.d):
		return "late", nil
	case <-ctx.Done():
		return "", ctx.Err()
	}
}

type mockPersister struct {
	mu   sync.Mutex
	logs []*models.JobExecutionLog
}

func (p *mockPersister) CreateJobExecutionLog(_ context.Context, log *models.JobExecutionLog) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.logs = append(p.logs, log)
	return nil
}

func (p *mockPersister) getLogs() []*models.JobExecutionLog {
	p.mu.Lock()
	defer p.mu.Unlock()
	cp := make([]*models.JobExecutionLog, len(p.logs))
	copy(cp, p.logs)
	return cp
}

func TestEngineExecuteSuccessFirstAttempt(t *testing.T) {
	p := &mockPersister{}
	e := NewExecutionEngine(p, nil)
	j := types.NewCronJob("j-1", "t-1", "good", types.KindRecurring, "* * * * *", "good", "")

	result := e.Execute(context.Background(), j, mockHandler{})
	if result.Status != "completed" {
		t.Fatalf("status = %q", result.Status)
	}
	if result.Attempt != 1 {
		t.Fatalf("attempt = %d", result.Attempt)
	}
	if result.Output != "ok" {
		t.Fatalf("output = %q", result.Output)
	}
	logs := p.getLogs()
	if len(logs) != 1 {
		t.Fatalf("log count = %d", len(logs))
	}
	if logs[0].Status != "completed" {
		t.Fatalf("persisted status = %q", logs[0].Status)
	}
}

func TestEngineExecuteRetriesThenSucceeds(t *testing.T) {
	p := &mockPersister{}
	e := NewExecutionEngine(p, nil)
	j := types.NewCronJob("j-1", "t-1", "flaky", types.KindRecurring, "* * * * *", "flaky", "")
	// shrink retry backoff for test speed
	j.RetryPolicy = types.RetryPolicy{MaxAttempts: 3, InitialDelay: 1 * time.Millisecond, MaxDelay: 1 * time.Millisecond}

	h := &flakyHandler{n: 2}
	result := e.Execute(context.Background(), j, h)
	if result.Status != "completed" {
		t.Fatalf("status = %q", result.Status)
	}
	if result.Attempt != 3 {
		t.Fatalf("attempt = %d, want 3", result.Attempt)
	}
	if result.Output != "recovered" {
		t.Fatalf("output = %q", result.Output)
	}
}

func TestEngineExecuteExhaustsRetries(t *testing.T) {
	p := &mockPersister{}
	e := NewExecutionEngine(p, nil)
	j := types.NewCronJob("j-1", "t-1", "fail", types.KindRecurring, "* * * * *", "fail", "")
	j.RetryPolicy = types.RetryPolicy{MaxAttempts: 2, InitialDelay: 1 * time.Millisecond, MaxDelay: 1 * time.Millisecond}

	result := e.Execute(context.Background(), j, alwaysFailHandler{})
	if result.Status != "failed" {
		t.Fatalf("status = %q", result.Status)
	}
	if result.Attempt != 2 {
		t.Fatalf("attempt = %d", result.Attempt)
	}
}

func TestEngineExecuteTimeout(t *testing.T) {
	p := &mockPersister{}
	e := NewExecutionEngine(p, nil)
	j := types.NewCronJob("j-1", "t-1", "slow", types.KindRecurring, "* * * * *", "slow", "")
	j.Timeout = 1 * time.Millisecond
	j.RetryPolicy.MaxAttempts = 1

	result := e.Execute(context.Background(), j, slowHandler{d: 100 * time.Millisecond})
	if result.Status != "failed" {
		t.Fatalf("status = %q, want failed", result.Status)
	}
	if result.Error != "job attempt timed out" {
		t.Fatalf("error = %q", result.Error)
	}
}

func TestEngineExecuteContextCancelled(t *testing.T) {
	p := &mockPersister{}
	e := NewExecutionEngine(p, nil)
	j := types.NewCronJob("j-1", "t-1", "cancel", types.KindRecurring, "* * * * *", "cancel", "")
	j.Timeout = 2 * time.Second
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // cancel immediately

	result := e.Execute(ctx, j, mockHandler{})
	if result.Status != "skipped" {
		t.Fatalf("status = %q, want skipped", result.Status)
	}
}

func TestEnginePersistNil(t *testing.T) {
	e := NewExecutionEngine(nil, nil)
	j := types.NewCronJob("j-1", "t-1", "no-persist", types.KindRecurring, "* * * * *", "x", "")
	result := e.Execute(context.Background(), j, mockHandler{})
	if result.Status != "completed" {
		t.Fatalf("status = %q", result.Status)
	}
}

func TestEngineExecuteCanceledBackoff(t *testing.T) {
	p := &mockPersister{}
	e := NewExecutionEngine(p, nil)
	j := types.NewCronJob("j-1", "t-1", "backoff-cancel", types.KindRecurring, "* * * * *", "x", "")
	j.RetryPolicy = types.RetryPolicy{
		MaxAttempts:   3,
		InitialDelay:  2 * time.Second,
		MaxDelay:      2 * time.Second,
		Multiplier:    1,
	}
	ctx, cancel := context.WithCancel(context.Background())

	h := &flakyHandler{n: 3}
	cancel() // cancel before first attempt
	result := e.Execute(ctx, j, h)
	if result.Status != "skipped" {
		t.Fatalf("status = %q", result.Status)
	}
}
