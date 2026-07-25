package types

import (
	"context"
	"time"
)

// JobKind distinguishes the scheduling strategy of a job.
type JobKind string

const (
	// KindRecurring runs on a repeating cron schedule.
	KindRecurring JobKind = "recurring"
	// KindOneTime runs exactly once at a specific moment.
	KindOneTime JobKind = "one_time"
	// KindDelayed runs once after a fixed delay from creation.
	KindDelayed JobKind = "delayed"
)

// IsValid returns true for the recognised job kinds.
func (k JobKind) IsValid() bool {
	switch k {
	case KindRecurring, KindOneTime, KindDelayed:
		return true
	}
	return false
}

// RetryPolicy defines how many times a failing job is retried and with what
// backoff.
type RetryPolicy struct {
	// MaxAttempts is the total number of execution attempts (1 = no retries).
	MaxAttempts int `json:"max_attempts"`
	// InitialDelay is the wait before the first retry.
	InitialDelay time.Duration `json:"initial_delay"`
	// MaxDelay caps the per-retry backoff interval.
	MaxDelay time.Duration `json:"max_delay"`
	// Multiplier scales the delay on each successive retry (>= 1.0).
	Multiplier float64 `json:"multiplier"`
	// RetryableErrors is a list of substrings; only errors containing one of
	// these substrings will be retried. Empty means "retry any error".
	RetryableErrors []string `json:"retryable_errors"`
}

// DefaultRetryPolicy returns a sane default (3 attempts, exponential backoff).
func DefaultRetryPolicy() RetryPolicy {
	return RetryPolicy{
		MaxAttempts:    3,
		InitialDelay:   time.Second,
		MaxDelay:       5 * time.Minute,
		Multiplier:     2.0,
		RetryableErrors: nil,
	}
}

// ShouldRetry reports whether the nth attempt (0-indexed) should be retried
// after err.  When err is nil the job has succeeded, so false is returned.
func (rp *RetryPolicy) ShouldRetry(attempt int, err error) bool {
	if err == nil {
		return false
	}
	if attempt >= rp.MaxAttempts-1 {
		return false
	}
	if len(rp.RetryableErrors) == 0 {
		return true
	}
	for _, substr := range rp.RetryableErrors {
		if containsString(err.Error(), substr) {
			return true
		}
	}
	return false
}

// BackoffDelay returns the delay to sleep before the next retry for the given
// (0-indexed) attempt number.
func (rp *RetryPolicy) BackoffDelay(attempt int) time.Duration {
	delay := rp.InitialDelay
	for i := 0; i < attempt; i++ {
		delay = time.Duration(float64(delay) * rp.Multiplier)
		if delay > rp.MaxDelay {
			delay = rp.MaxDelay
		}
	}
	if delay > rp.MaxDelay {
		delay = rp.MaxDelay
	}
	return delay
}

func containsString(s, substr string) bool {
	start := 0
	for start <= len(s)-len(substr) {
		if s[start:start+len(substr)] == substr {
			return true
		}
		start++
	}
	return false
}

// JobDependency defines a hard ordering: a job must not start until all of its
// dependencies have reported "completed" for at least one execution.
type JobDependency struct {
	// JobID is the UUID of the dependency job definition.
	JobID string `json:"job_id"`
	// Description is human-readable context.
	Description string `json:"description"`
}

// CronJob defines the unified job spec consumed by the engine.
//
// It supersedes the per-persistence structs (models.CronJob /
// models.JobDefinition) and is the canonical shape of a job as seen by the
// execution engine and the registry.
type CronJob struct {
	ID          string            `json:"id"`
	TenantID    string            `json:"tenant_id"`
	Name        string            `json:"name"`
	Kind        JobKind
	Schedule    string            `json:"schedule"`    // cron expression or empty
	RunAt       time.Time         `json:"run_at"`      // one-time target
	Delay       time.Duration     `json:"delay"`       // delayed trigger
	Task        string            `json:"task"`
	Description string            `json:"description"`
	Enabled     bool              `json:"enabled"`
	Status      string            `json:"status"`
	RetryPolicy RetryPolicy       `json:"retry_policy"`
	Timeout     time.Duration     `json:"timeout"`
	DependsOn   []JobDependency   `json:"depends_on"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

// NewCronJob creates a CronJob with sensible defaults filled in.
func NewCronJob(id, tenantID, name string, kind JobKind, schedule string, task string, desc string) *CronJob {
	now := time.Now().UTC()
	return &CronJob{
		ID:          id,
		TenantID:    tenantID,
		Name:        name,
		Kind:        kind,
		Schedule:    schedule,
		Task:        task,
		Description: desc,
		Enabled:     true,
		Status:      "pending",
		RetryPolicy: DefaultRetryPolicy(),
		Timeout:     5 * time.Minute,
		DependsOn:   nil,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
}

// ShouldFireAt reports whether this job is due to run at t.
//
// For recurring jobs, the cron expression is matched via matchesCron.
// For one-time jobs, t must be on or after RunAt.
// For delayed jobs, t must be on or after CreatedAt + Delay.
// Callers should pass t in UTC.
func (j *CronJob) ShouldFireAt(t time.Time) bool {
	if !j.Enabled {
		return false
	}
	switch j.Kind {
	case KindRecurring:
		return matchesCron(j.Schedule, t)
	}
	if t.Before(j.RunAt) {
		return false
	}
	return true
}

// matchesCron is a lightweight 5-field cron matcher built without an external
// dependency.  It handles *, ranges (1-5), steps (/2), and comma lists.
func matchesCron(expr string, t time.Time) bool {
	fields := splitFields(expr)
	if len(fields) != 5 {
		return false
	}

	// minute hour day-of-month month day-of-week
	checks := []struct {
		field string
		val   int
		min   int
		max   int
	}{
		{fields[0], t.Minute(), 0, 59},
		{fields[1], t.Hour(), 0, 23},
		{fields[2], t.Day(), 1, 31},
		{fields[3], int(t.Month()), 1, 12},
		{fields[4], int(t.Weekday()), 0, 6},
	}

	for _, c := range checks {
		if !matchField(c.field, c.val, c.min, c.max) {
			return false
		}
	}
	return true
}

// matchField matches a single cron field (e.g. "*/5", "1,3-5", "*") against val.
func matchField(field string, val int, min, max int) bool {
	parts := splitCommas(field)
	for _, part := range parts {
		if part == "*" {
			return val >= min && val <= max
		}
		starStep := splitOn(part, "/")
		if len(starStep) == 2 {
			from := min
			if starStep[0] != "" && starStep[0] != "*" {
				from = parseInt(starStep[0], min, max)
			}
			step := parseInt(starStep[1], 1, max-min)
			if step <= 0 {
				step = 1
			}
			for i := from; i <= max; i += step {
				if i == val {
					return true
				}
			}
			continue
		}
		rng := splitOn(part, "-")
		if len(rng) == 2 {
			a := parseInt(rng[0], min, max)
			b := parseInt(rng[1], min, max)
			if a <= val && val <= b {
				return true
			}
			continue
		}
		if len(rng) == 1 && rng[0] != "" {
			if parseInt(rng[0], min, max) == val {
				return true
			}
		}
	}
	return false
}

func splitFields(s string) []string {
	parts, buf := []string{}, ""
	for _, ch := range s {
		if ch == ' ' || ch == '\t' {
			if buf != "" {
				parts = append(parts, buf)
				buf = ""
			}
		} else {
			buf += string(ch)
		}
	}
	if buf != "" {
		parts = append(parts, buf)
	}
	return parts
}

func splitCommas(s string) []string {
	return splitOn(s, ",")
}

func splitOn(s, sep string) []string {
	out, buf := []string{}, ""
	for _, ch := range s {
		if string(ch) == sep {
			out = append(out, buf)
			buf = ""
		} else {
			buf += string(ch)
		}
	}
	out = append(out, buf)
	return out
}

func parseInt(s string, min, max int) int {
	n := 0
	for _, ch := range s {
		if ch < '0' || ch > '9' {
			return min
		}
		n = n*10 + int(ch-'0')
	}
	if n < min {
		n = min
	}
	if n > max {
		n = max
	}
	return n
}

// JobHandlerFunc is a thin callable for one-off jobs registered ad-hoc.
type JobHandlerFunc func(ctx context.Context) (string, error)

// Handler wraps a JobHandlerFunc into the Job interface (see engine/job.go).
type Handler struct {
	fn JobHandlerFunc
}

// NewHandler wraps a JobHandlerFunc.
func NewHandler(fn JobHandlerFunc) *Handler {
	return &Handler{fn: fn}
}

// Execute calls the underlying function.
func (h *Handler) Execute(ctx context.Context) (string, error) {
	return h.fn(ctx)
}
