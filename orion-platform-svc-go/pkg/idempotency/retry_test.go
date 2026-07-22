package idempotency

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"
)

func TestRetrySuccessOnFirst(t *testing.T) {
	var count int64
	err := Retry(context.Background(), RetryConfig{MaxAttempts: 3}, func() error {
		atomic.AddInt64(&count, 1)
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if atomic.LoadInt64(&count) != 1 {
		t.Fatalf("expected 1 call, got %d", atomic.LoadInt64(&count))
	}
}

func TestRetrySuccessOnRetry(t *testing.T) {
	var count int64
	err := Retry(context.Background(), RetryConfig{
		MaxAttempts:  3,
		InitialDelay: 10 * time.Millisecond,
		MaxDelay:     20 * time.Millisecond,
	}, func() error {
		atomic.AddInt64(&count, 1)
		if atomic.LoadInt64(&count) < 3 {
			return errors.New("not yet")
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if atomic.LoadInt64(&count) != 3 {
		t.Fatalf("expected 3 calls, got %d", atomic.LoadInt64(&count))
	}
}

func TestRetryMaxAttempts(t *testing.T) {
	err := Retry(context.Background(), RetryConfig{MaxAttempts: 2}, func() error {
		return errors.New("fail")
	})
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestRetryRetryableFilter(t *testing.T) {
	var count int64
	err := Retry(context.Background(), RetryConfig{
		MaxAttempts:  3,
		InitialDelay: 10 * time.Millisecond,
		Retryable: func(e error) bool {
			return e.Error() == "retryable"
		},
	}, func() error {
		atomic.AddInt64(&count, 1)
		if atomic.LoadInt64(&count) == 1 {
			return errors.New("retryable")
		}
		return errors.New("not retryable")
	})
	if err == nil {
		t.Fatal("expected error")
	}
	if atomic.LoadInt64(&count) != 2 {
		t.Fatalf("expected 2 calls, got %d", atomic.LoadInt64(&count))
	}
}

func TestRetryOnRetryHook(t *testing.T) {
	var hookCalls int64
	var hookErrs []string
	err := Retry(context.Background(), RetryConfig{
		MaxAttempts:  3,
		InitialDelay: 10 * time.Millisecond,
		OnRetry: func(attempt int, lastErr error) {
			atomic.AddInt64(&hookCalls, 1)
			hookErrs = append(hookErrs, lastErr.Error())
		},
	}, func() error {
		return errors.New("boom")
	})
	if err == nil {
		t.Fatal("expected error")
	}
	if atomic.LoadInt64(&hookCalls) != 2 {
		t.Fatalf("expected 2 hook calls, got %d", atomic.LoadInt64(&hookCalls))
	}
	if len(hookErrs) != 2 || hookErrs[0] != "boom" || hookErrs[1] != "boom" {
		t.Fatalf("unexpected hook errors: %v", hookErrs)
	}
}

func TestRetryContextCancelled(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Millisecond)
	defer cancel()

	err := Retry(ctx, RetryConfig{
		MaxAttempts:  10,
		InitialDelay: 100 * time.Millisecond,
	}, func() error {
		return errors.New("fail")
	})
	if err != context.DeadlineExceeded {
		t.Fatalf("expected context deadline exceeded, got %v", err)
	}
}

func TestRetryDefaults(t *testing.T) {
	var count int64
	err := Retry(context.Background(), RetryConfig{}, func() error {
		atomic.AddInt64(&count, 1)
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if atomic.LoadInt64(&count) != 1 {
		t.Fatalf("expected 1 call with defaults, got %d", atomic.LoadInt64(&count))
	}
}

