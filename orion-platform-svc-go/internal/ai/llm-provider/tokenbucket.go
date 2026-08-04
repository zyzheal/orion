package llmprovider

import (
	"context"
	"sync"
	"time"
)

// TokenBucket implements the token bucket rate-limiting algorithm.
// Tokens refill at a constant rate up to the configured capacity.
// Each request consumes tokens; requests are rejected when the bucket is empty.
//
// This provides a leaky-bucket style smoothing that allows short bursts
// (up to Capacity) while enforcing a long-term average rate.
type TokenBucket struct {
	mu sync.Mutex

	// Capacity is the maximum number of tokens the bucket can hold.
	Capacity int64

	// RefillRate is the number of tokens added per second.
	RefillRate float64

	// tokens is the current number of available tokens (not exported; accessed via mutex).
	tokens float64

	// lastRefill records when tokens were last added.
	lastRefill time.Time
}

// NewTokenBucket creates a TokenBucket filled to capacity.
func NewTokenBucket(capacity int64, refillRate float64) *TokenBucket {
	now := time.Now()
	return &TokenBucket{
		Capacity:   capacity,
		RefillRate: refillRate,
		tokens:     float64(capacity),
		lastRefill: now,
	}
}

// Allow attempts to consume the given number of tokens.
// Returns true if the request is allowed; false if the bucket does not have
// enough tokens.
func (tb *TokenBucket) Allow(n int64) bool {
	tb.mu.Lock()
	defer tb.mu.Unlock()
	tb.refill()
	if tb.tokens >= float64(n) {
		tb.tokens -= float64(n)
		return true
	}
	return false
}

// Wait blocks until the given number of tokens are available, respecting
// the provided context for cancellation and timeout. Returns nil on success
// or ctx.Err() if the context expired before tokens became available.
func (tb *TokenBucket) Wait(ctx context.Context, n int64) error {
	for {
		tb.mu.Lock()
		tb.refill()
		if tb.tokens >= float64(n) {
			tb.tokens -= float64(n)
			tb.mu.Unlock()
			return nil
		}

		// Compute how long until enough tokens are available.
		needed := float64(n) - tb.tokens
		wait := time.Duration(needed/tb.RefillRate*float64(time.Second))
		tb.mu.Unlock()

		// Wait no longer than the context allows.
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(wait):
		}
	}
}

// Available returns the current number of available tokens (without consuming).
func (tb *TokenBucket) Available() int64 {
	tb.mu.Lock()
	defer tb.mu.Unlock()
	tb.refill()
	return int64(tb.tokens)
}

// Capacity returns the bucket's maximum capacity.
func (tb *TokenBucket) GetCapacity() int64 {
	tb.mu.Lock()
	defer tb.mu.Unlock()
	return tb.Capacity
}

// SetCapacity updates the bucket's capacity (and refill rate if desired).
// Tokens are not lost; they are capped to the new capacity.
func (tb *TokenBucket) SetCapacity(capacity int64, refillRate float64) {
	tb.mu.Lock()
	defer tb.mu.Unlock()
	tb.Capacity = capacity
	tb.RefillRate = refillRate
	tb.refill()
	if int64(tb.tokens) > capacity {
		tb.tokens = float64(capacity)
	}
}

// refill adds tokens based on elapsed time since the last refill.
// Must be called while holding tb.mu.
func (tb *TokenBucket) refill() {
	now := time.Now()
	elapsed := now.Sub(tb.lastRefill).Seconds()
	tb.lastRefill = now

	if elapsed <= 0 || tb.RefillRate <= 0 {
		return
	}

	tb.tokens += elapsed * tb.RefillRate
	if int64(tb.tokens) > tb.Capacity {
		tb.tokens = float64(tb.Capacity)
	}
}
