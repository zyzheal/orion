package idempotency

import (
	"context"
	"time"
)

// RetryConfig configures a Retry invocation.
type RetryConfig struct {
	// MaxAttempts is the maximum number of times fn will be called.
	// Must be >= 1; defaults to 3.
	MaxAttempts int

	// InitialDelay is the delay before the second attempt.
	InitialDelay time.Duration

	// MaxDelay is the upper bound for any individual delay.
	MaxDelay time.Duration

	// Multiplier is the exponential growth factor (default 2.0).
	Multiplier float64

	// Retryable determines which errors should trigger another attempt.
	// Nil means all errors are retryable.
	Retryable func(error) bool

	// OnRetry is called before each retry attempt with the attempt
	// number (1-based, 1 = first retry) and the last error.
	OnRetry func(attempt int, err error)
}

// defaultRetryConfig returns a configured default.
func defaultRetryConfig() RetryConfig {
	return RetryConfig{
		MaxAttempts:  3,
		InitialDelay: 100 * time.Millisecond,
		MaxDelay:     5 * time.Second,
		Multiplier:   2.0,
		Retryable:    nil,
		OnRetry:      nil,
	}
}

// shouldRetry reports whether the given error warrants another attempt
// using the configured Retryable predicate.
func (c RetryConfig) shouldRetry(err error) bool {
	if c.Retryable == nil {
		return true
	}
	return c.Retryable(err)
}

// Retry invokes fn up to MaxAttempts times with exponential backoff.
// It returns the first non-error result, or the last error if all
// attempts fail.
//
// Context cancellation is respected: if ctx is cancelled, Retry
// returns ctx.Err() immediately (without calling fn again).
func Retry(ctx context.Context, config RetryConfig, fn func() error) error {
	cfg := config
	if cfg.MaxAttempts <= 0 {
		cfg = defaultRetryConfig()
	}
	if cfg.MaxAttempts == 0 {
		cfg.MaxAttempts = defaultRetryConfig().MaxAttempts
	}

	bo := NewExponentialBackoffWithMultiplier(
		cfg.InitialDelay, cfg.MaxDelay, cfg.Multiplier,
	)

	var lastErr error
	for attempt := 1; attempt <= cfg.MaxAttempts; attempt++ {
		// Check context before attempting.
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		lastErr = fn()
		if lastErr == nil {
			return nil
		}

		if attempt == cfg.MaxAttempts {
			break
		}

		if !cfg.shouldRetry(lastErr) {
			break
		}

		delay := bo.Next()
		if cfg.OnRetry != nil {
			cfg.OnRetry(attempt, lastErr)
		}

		// Sleep, respecting context cancellation.
		timer := time.NewTimer(delay)
		select {
		case <-ctx.Done():
			timer.Stop()
			return ctx.Err()
		case <-timer.C:
		}
	}

	return lastErr
}
