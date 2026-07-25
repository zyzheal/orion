package cron

import (
	"context"
	"math"
	"time"
)

// IJob defines the contract for any scheduled task that the Scheduler can
// discover, register, and execute. Every cron-managed job must implement all
// four methods.
//
//  - Name()     : unique identifier within the scheduler
//  - Execute()  : the actual work; receives a timeout-bound context
//  - Retry()    : whether the scheduler may auto-retry after transient failure
//  - Timeout()  : hard ceiling per invocation (scheduler aborts if exceeded)
//
// The scheduler treats nil returned from Execute as "completed OK". Any non-nil
// error is logged and, when Retry() == true, retried up to MaxRetries times
// (see SchedulerConfig).
type IJob interface {
	Name() string
	Execute(ctx context.Context) error
	Retry() bool
	Timeout() time.Duration
}

// RetryPolicy describes how the scheduler should behave after a failed job
// invocation.  The scheduler reads Retry() from the job; this type lets a
// caller override it at registration time via WithRetryPolicy.
type RetryPolicy struct {
	// Enabled controls whether retries happen. If false, Retry() is ignored.
	Enabled bool

	// MaxAttempts is the total number of attempts (1 = no retry). Defaults to 1.
	MaxAttempts int

	// BackoffBase is the initial delay before the first retry. Subsequent
	// delays are multiplied by BackoffFactor, capped by BackoffMax.
	BackoffBase time.Duration

	// BackoffFactor scales the delay after each failed attempt. Defaults to 2.
	BackoffFactor float64

	// BackoffMax is the longest retry delay. Defaults to 5 minutes.
	BackoffMax time.Duration
}

// DefaultRetryPolicy returns a sane default (1 attempt, no retry).
func DefaultRetryPolicy() RetryPolicy {
	return RetryPolicy{
		MaxAttempts:   1,
		BackoffBase:   0,
		BackoffFactor: 0,
		BackoffMax:    0,
	}
}

// EffectiveAttempts returns the total number of attempts for this policy.
// Zero means "no retry".
func (p RetryPolicy) EffectiveAttempts() int {
	if p.MaxAttempts < 1 {
		return 1
	}
	return p.MaxAttempts
}

// EffectiveBackoff returns (delay, capped) for the given attempt number
// (attempt == 0 means no delay before the first try).
func (p RetryPolicy) EffectiveBackoff(attempt int) (time.Duration, bool) {
	base := p.BackoffBase
	if base <= 0 {
		return 0, true
	}
	factor := p.BackoffFactor
	if factor <= 0 {
		factor = 2.0
	}
	maxDelay := p.BackoffMax
	if maxDelay <= 0 {
		maxDelay = 5 * time.Minute
	}

	delay := time.Duration(float64(base) * math.Pow(factor, float64(attempt)))
	capped := delay > maxDelay
	if capped {
		delay = maxDelay
	}
	return delay, capped
}

// IsRetriableError determines whether an error is worth retrying.
// The default considers ctx.Done() errors non-retryable (they indicate a
// caller cancellation or timeout). All other errors are retried when the
// policy allows.
func (p RetryPolicy) IsRetriableError(err error) bool {
	if err == nil {
		return false
	}
	// Context errors are never retried: caller cancelled or timeout hit.
	select {
	case <-context.Background().Done():
		return false // unreachable but satisfies compiler for pattern match below
	default:
	}
	// Use errors.Is pattern; callers with custom domain errors should wrap ctx errors.
	return err.Error() != "context canceled" && err.Error() != "context deadline exceeded"
}
