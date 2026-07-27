package types

import (
	"context"
	"testing"
	"time"
)

func TestJobKindIsValid(t *testing.T) {
	cases := []struct {
		kind   JobKind
		expect bool
	}{
		{KindRecurring, true},
		{KindOneTime, true},
		{KindDelayed, true},
		{"unknown", false},
		{"", false},
	}
	for _, c := range cases {
		if c.kind.IsValid() != c.expect {
			t.Errorf("JobKind(%q).IsValid() = %v, want %v", c.kind, c.kind.IsValid(), c.expect)
		}
	}
}

func TestRetryPolicyShouldRetry(t *testing.T) {
	rp := DefaultRetryPolicy()
	if rp.ShouldRetry(0, context.DeadlineExceeded) {
		// 0-indexed attempt 0 -> max attempts is 3, so 0 < 2 => true
	} else {
		t.Errorf("expected ShouldRetry(0, err) = true")
	}
	if rp.ShouldRetry(2, context.DeadlineExceeded) {
		t.Errorf("expected ShouldRetry(2, err) = false (last attempt)")
	}
	if rp.ShouldRetry(0, nil) {
		t.Errorf("expected ShouldRetry(0, nil) = false")
	}

	// retryable-errors filter
	filtered := RetryPolicy{MaxAttempts: 3, RetryableErrors: []string{"deadline"}}
	if !filtered.ShouldRetry(0, context.DeadlineExceeded) {
		t.Errorf("expected filtered retry for deadline")
	}
	if filtered.ShouldRetry(0, context.Canceled) {
		t.Errorf("expected no retry for cancellation")
	}
}

func TestRetryPolicyBackoffDelay(t *testing.T) {
	rp := RetryPolicy{InitialDelay: time.Second, MaxDelay: 10 * time.Second, Multiplier: 2.0}
	cases := []struct {
		attempt int
		want    time.Duration
	}{
		{0, 1 * time.Second},
		{1, 2 * time.Second},
		{2, 4 * time.Second},
		{4, 10 * time.Second}, // capped at MaxDelay
	}
	for _, c := range cases {
		got := rp.BackoffDelay(c.attempt)
		if got != c.want {
			t.Errorf("BackoffDelay(%d) = %v, want %v", c.attempt, got, c.want)
		}
	}
}

func TestNewCronJob(t *testing.T) {
	now := time.Now().UTC()
	j := NewCronJob("j-1", "t-1", "cleanup", KindRecurring, "*/5 * * * *", "cleanup", "test job")
	if j.ID != "j-1" {
		t.Fatalf("ID = %q", j.ID)
	}
	if j.Kind != KindRecurring {
		t.Fatalf("Kind = %s", j.Kind)
	}
	if j.RetryPolicy.MaxAttempts != 3 {
		t.Fatalf("MaxAttempts = %d", j.RetryPolicy.MaxAttempts)
	}
	if j.Timeout != 5*time.Minute {
		t.Fatalf("Timeout = %v", j.Timeout)
	}
	if j.CreatedAt.After(now.Add(time.Minute)) {
		t.Fatalf("CreatedAt too far in the future: %v", j.CreatedAt)
	}
}

func TestCronJobShouldFireAtRecurring(t *testing.T) {
	j := NewCronJob("j-1", "t-1", "cleanup", KindRecurring, "* * * * *", "cleanup", "")
	// Every minute => should always fire
	for i := 0; i < 60; i++ {
		tt := time.Date(2025, 1, 15, 12, i, 0, 0, time.UTC)
		if !j.ShouldFireAt(tt) {
			t.Errorf("ShouldFireAt(%v) = false, want true", tt)
		}
	}
}

func TestCronJobShouldFireAtOneTime(t *testing.T) {
	j := NewCronJob("j-1", "t-1", "once", KindOneTime, "", "once", "")
	j.RunAt = time.Date(2025, 6, 1, 10, 0, 0, 0, time.UTC)
	if j.ShouldFireAt(time.Date(2025, 6, 1, 9, 0, 0, 0, time.UTC)) {
		t.Fatalf("ShouldFireAt(before RunAt) = true, want false")
	}
	if !j.ShouldFireAt(time.Date(2025, 6, 1, 10, 0, 0, 0, time.UTC)) {
		t.Fatalf("ShouldFireAt(at RunAt) = false, want true")
	}
	if !j.ShouldFireAt(time.Date(2025, 6, 1, 11, 0, 0, 0, time.UTC)) {
		t.Fatalf("ShouldFireAt(after RunAt) = false, want true")
	}
}

func TestCronJobShouldFireAtDisabled(t *testing.T) {
	j := NewCronJob("j-1", "t-1", "disabled", KindRecurring, "* * * * *", "x", "")
	j.Enabled = false
	if j.ShouldFireAt(time.Date(2025, 6, 1, 10, 0, 0, 0, time.UTC)) {
		t.Fatalf("disabled job ShouldFireAt = true, want false")
	}
}

func TestMatchesCronMinute(t *testing.T) {
	cases := []struct {
		expr  string
		when  time.Time
		match bool
	}{
		// every minute, hour 12
		{"* 12 * * *", time.Date(2025, 1, 15, 12, 30, 0, 0, time.UTC), true},
		{"* 12 * * *", time.Date(2025, 1, 15, 11, 30, 0, 0, time.UTC), false},
		// every 5 minutes
		{"*/5 * * * *", time.Date(2025, 1, 15, 12, 10, 0, 0, time.UTC), true},
		{"*/5 * * * *", time.Date(2025, 1, 15, 12, 13, 0, 0, time.UTC), false},
		// range
		{"1-3 * * * *", time.Date(2025, 1, 15, 12, 2, 0, 0, time.UTC), true},
		{"1-3 * * * *", time.Date(2025, 1, 15, 12, 4, 0, 0, time.UTC), false},
		// comma list
		{"1,15,30 * * * *", time.Date(2025, 1, 15, 12, 15, 0, 0, time.UTC), true},
		{"1,15,30 * * * *", time.Date(2025, 1, 15, 12, 20, 0, 0, time.UTC), false},
	}
	for _, c := range cases {
		got := matchesCron(c.expr, c.when)
		if got != c.match {
			t.Errorf("matchesCron(%q, %v) = %v, want %v", c.expr, c.when, got, c.match)
		}
	}
}

func TestHandlerExecute(t *testing.T) {
	var called bool
	h := NewHandler(func(ctx context.Context) (string, error) {
		called = true
		return "ok", nil
	})
	out, err := h.Execute(context.Background())
	if !called || out != "ok" || err != nil {
		t.Fatalf("Execute failed: called=%v out=%q err=%v", called, out, err)
	}
}

func TestParseError(t *testing.T) {
	e := &ParseError{Expr: "bad", Cause: context.DeadlineExceeded}
	if e.Error() == "" {
		t.Fatalf("ParseError.Error() = empty")
	}
	if e.Unwrap() != context.DeadlineExceeded {
		t.Fatalf("ParseError.Unwrap() != DeadlineExceeded")
	}
}
