package idempotency

import (
	"math/rand"
	"sync"
	"time"
)

// Backoff defines the strategy for computing retry delays.
type Backoff interface {
	// Next returns the next delay.  Implementations must be safe for
	// concurrent use by a single goroutine (they do NOT need to be
	// thread-safe across goroutines).
	Next() time.Duration
}

// ExponentialBackoff yields a geometrically increasing delay capped at
// maxDelay.
type ExponentialBackoff struct {
	mu         sync.Mutex
	initial    time.Duration
	current    time.Duration
	max        time.Duration
	multiplier float64
}

// NewExponentialBackoff creates a backoff that starts at initial and
// doubles until max (multiplier defaults to 2.0).
func NewExponentialBackoff(initial, max time.Duration) *ExponentialBackoff {
	return &ExponentialBackoff{
		initial:    initial,
		current:    initial,
		max:        max,
		multiplier: 2.0,
	}
}

// NewExponentialBackoffWithMultiplier returns an exponential backoff
// with an explicit multiplier.
func NewExponentialBackoffWithMultiplier(initial, max time.Duration, multiplier float64) *ExponentialBackoff {
	return &ExponentialBackoff{
		initial:    initial,
		current:    initial,
		max:        max,
		multiplier: multiplier,
	}
}

func (b *ExponentialBackoff) Next() time.Duration {
	b.mu.Lock()
	defer b.mu.Unlock()

	delay := b.current
	next := time.Duration(float64(b.current) * b.multiplier)
	if next > b.max {
		next = b.max
	}
	b.current = next
	return delay
}

// Reset brings the backoff back to its initial delay.
func (b *ExponentialBackoff) Reset() {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.current = b.initial
}

// JitteredBackoff wraps any Backoff and adds ±jitterFactor randomisation
// to each delay, reducing thundering-herd effects.
type JitteredBackoff struct {
	base   Backoff
	rng    *rand.Rand
	mu     sync.Mutex
	factor float64 // range [0,1) — added as ±factor * delay
}

// NewJitteredBackoff wraps base with the given jitter factor.  A factor
// of 0.3 means the returned delay is in [0.7*base, 1.3*base].
func NewJitteredBackoff(base Backoff, jitterFactor float64) *JitteredBackoff {
	if jitterFactor < 0 {
		jitterFactor = 0
	}
	if jitterFactor > 1 {
		jitterFactor = 1
	}
	return &JitteredBackoff{
		base:   base,
		rng:    rand.New(rand.NewSource(time.Now().UnixNano())),
		factor: jitterFactor,
	}
}

func (b *JitteredBackoff) Next() time.Duration {
	b.mu.Lock()
	defer b.mu.Unlock()

	delay := b.base.Next()
	if delay == 0 || b.factor == 0 {
		return delay
	}

	jitter := (b.rng.Float64()*2 - 1) * b.factor // range [-factor, factor]
	return time.Duration(float64(delay) * (1 + jitter))
}

// FixedBackoff always returns the same delay regardless of how many
// times Next() is called.
type FixedBackoff struct {
	delay time.Duration
}

// NewFixedBackoff creates a backoff that always returns delay.
func NewFixedBackoff(delay time.Duration) *FixedBackoff {
	return &FixedBackoff{delay: delay}
}

func (b *FixedBackoff) Next() time.Duration {
	return b.delay
}
