package circuitbreaker

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"
)

var errFailure = errors.New("service unavailable")

func TestCircuitBreakerInitialState(t *testing.T) {
	cb := New("test", Config{
		FailureThreshold: 3,
		SuccessThreshold: 2,
		Timeout:          100 * time.Millisecond,
	})

	if cb.State() != StateClosed {
		t.Errorf("state = %s, want CLOSED", cb.State())
	}
	if cb.Failures() != 0 {
		t.Errorf("failures = %d, want 0", cb.Failures())
	}
}

func TestCircuitBreakerExecuteSuccess(t *testing.T) {
	cb := New("test", DefaultConfig())

	err := cb.Execute(context.Background(), func(ctx context.Context) error {
		return nil
	})
	if err != nil {
		t.Fatalf("Execute failed: %v", err)
	}
	if cb.State() != StateClosed {
		t.Errorf("state = %s, want CLOSED", cb.State())
	}
}

func TestCircuitBreakerExecuteFailure(t *testing.T) {
	cb := New("test", DefaultConfig())

	err := cb.Execute(context.Background(), func(ctx context.Context) error {
		return errFailure
	})
	if err != errFailure {
		t.Fatalf("Execute returned %v, want errFailure", err)
	}
	if cb.Failures() != 1 {
		t.Errorf("failures = %d, want 1", cb.Failures())
	}
}

func TestCircuitBreakerOpensAfterThreshold(t *testing.T) {
	cb := New("test", Config{
		FailureThreshold: 3,
		SuccessThreshold: 2,
		Timeout:          1 * time.Second,
	})

	// 3 failures should open the circuit
	for i := 0; i < 3; i++ {
		cb.Execute(context.Background(), func(ctx context.Context) error {
			return errFailure
		})
	}

	if cb.State() != StateOpen {
		t.Errorf("state = %s, want OPEN", cb.State())
	}
}

func TestCircuitBreakerRejectsWhenOpen(t *testing.T) {
	cb := New("test", Config{
		FailureThreshold: 3,
		Timeout:          30 * time.Second,
	})

	for i := 0; i < 3; i++ {
		cb.Execute(context.Background(), func(ctx context.Context) error {
			return errFailure
		})
	}

	callCount := 0
	err := cb.Execute(context.Background(), func(ctx context.Context) error {
		callCount++
		return nil
	})

	if callCount != 0 {
		t.Error("function should not have been called when circuit is OPEN")
	}
	if err == nil {
		t.Error("expected error when circuit is OPEN")
	}
}

func TestCircuitBreakerTransitionsToHalfOpen(t *testing.T) {
	cb := New("test", Config{
		FailureThreshold: 3,
		SuccessThreshold: 2,
		Timeout:          50 * time.Millisecond,
	})

	for i := 0; i < 3; i++ {
		cb.Execute(context.Background(), func(ctx context.Context) error {
			return errFailure
		})
	}

	if cb.State() != StateOpen {
		t.Errorf("expected OPEN, got %s", cb.State())
	}

	// Wait for timeout
	time.Sleep(100 * time.Millisecond)

	// Next request should trigger HALF_OPEN transition
	callCount := 0
	cb.Execute(context.Background(), func(ctx context.Context) error {
		callCount++
		return nil
	})

	if callCount != 1 {
		t.Error("request should be allowed in HALF_OPEN")
	}
	if cb.State() != StateHalfOpen {
		t.Errorf("state = %s, want HALF_OPEN", cb.State())
	}
}

func TestCircuitBreakerClosesAfterSuccesses(t *testing.T) {
	cb := New("test", Config{
		FailureThreshold:    3,
		SuccessThreshold:    2,
		Timeout:             50 * time.Millisecond,
		HalfOpenMaxRequests: 2,
	})

	// Open the circuit
	for i := 0; i < 3; i++ {
		cb.Execute(context.Background(), func(ctx context.Context) error {
			return errFailure
		})
	}

	// Wait for HALF_OPEN
	time.Sleep(100 * time.Millisecond)

	// 2 successes in HALF_OPEN should close it
	var mu sync.Mutex
	results := make([]error, 0, 2)
	for i := 0; i < 2; i++ {
		cb.Execute(context.Background(), func(ctx context.Context) error {
			mu.Lock()
			results = append(results, nil)
			mu.Unlock()
			return nil
		})
	}

	if cb.State() != StateClosed {
		t.Errorf("state = %s, want CLOSED", cb.State())
	}
	if cb.Failures() != 0 {
		t.Errorf("failures = %d, want 0 after reset", cb.Failures())
	}
}

func TestCircuitBreakerReset(t *testing.T) {
	cb := New("test", Config{
		FailureThreshold: 3,
		Timeout:          1 * time.Second,
	})

	for i := 0; i < 3; i++ {
		cb.Execute(context.Background(), func(ctx context.Context) error {
			return errFailure
		})
	}

	if cb.State() != StateOpen {
		t.Errorf("expected OPEN before reset, got %s", cb.State())
	}

	cb.Reset()

	if cb.State() != StateClosed {
		t.Errorf("state = %s after reset, want CLOSED", cb.State())
	}
	if cb.Failures() != 0 {
		t.Errorf("failures = %d after reset, want 0", cb.Failures())
	}
}

func TestCircuitBreakerForceOpenClose(t *testing.T) {
	cb := New("test", DefaultConfig())

	cb.ForceOpen("admin")
	if cb.State() != StateOpen {
		t.Errorf("state = %s, want OPEN", cb.State())
	}

	cb.ForceClose("admin")
	if cb.State() != StateClosed {
		t.Errorf("state = %s, want CLOSED", cb.State())
	}
}

func TestCircuitBreakerStateChangeCallback(t *testing.T) {
	var events []Event
	cb := New("test", Config{
		FailureThreshold: 3,
		Timeout:          1 * time.Second,
		OnStateChange: func(e Event) {
			events = append(events, e)
		},
	})

	for i := 0; i < 3; i++ {
		cb.Execute(context.Background(), func(ctx context.Context) error {
			return errFailure
		})
	}

	if len(events) != 1 {
		t.Fatalf("expected 1 event, got %d", len(events))
	}
	if events[0].From != StateClosed || events[0].To != StateOpen {
		t.Errorf("unexpected transition: %s → %s", events[0].From, events[0].To)
	}
}
