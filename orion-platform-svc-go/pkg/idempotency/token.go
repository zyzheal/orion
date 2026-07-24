package idempotency

import (
	"context"
	"sync"
	"time"
)

// TokenBucket is a thread-safe token-bucket rate limiter.  It is
// suitable for bounding the rate of write operations that carry an
// idempotency key.
type TokenBucket struct {
	capacity    int64   // maximum tokens
	available   int64   // current token count
	refillRate  int64   // nanoseconds between refills
	lastRefill  int64   // monotonic timestamp of last refill
	mu          sync.Mutex
}

// TokenBucketOption configures a TokenBucket.
type TokenBucketOption func(*TokenBucket)

// WithCapacity sets the bucket capacity (and initial available tokens).
// Defaults to 10.
func WithCapacity(capacity int) TokenBucketOption {
	return func(tb *TokenBucket) {
		tb.capacity = int64(capacity)
		tb.available = int64(capacity)
	}
}

// WithRefillRate sets the interval at which a single token is added.
// Defaults to 1 second.
func WithRefillRate(rate time.Duration) TokenBucketOption {
	return func(tb *TokenBucket) {
		tb.refillRate = int64(rate)
	}
}

// NewTokenBucket creates a new bucket with the given capacity and
// refill rate.  Use options to customise defaults.
func NewTokenBucket(opts ...TokenBucketOption) *TokenBucket {
	tb := &TokenBucket{
		capacity:   10,
		available:  10,
		refillRate: int64(time.Second),
	}
	for _, opt := range opts {
		opt(tb)
	}
	tb.lastRefill = time.Now().UnixNano()
	return tb
}

// refill adds tokens accumulated since the last call.  Must be called
// while holding tb.mu.
func (tb *TokenBucket) refill() {
	now := time.Now().UnixNano()
	if tb.refillRate <= 0 {
		return
	}
	elapsed := now - tb.lastRefill
	tokens := elapsed / tb.refillRate
	if tokens <= 0 {
		return
	}
	tb.lastRefill = now - (elapsed % tb.refillRate)
	tb.available += tokens
	if tb.available > tb.capacity {
		tb.available = tb.capacity
	}
}

// Allow reports whether a token can be consumed right now.
// It does NOT consume the token.
func (tb *TokenBucket) Allow() bool {
	tb.mu.Lock()
	defer tb.mu.Unlock()
	tb.refill()
	return tb.available >= 1
}

// Consume attempts to take one token.  It returns true if the token
// was consumed, false if the bucket is empty.
func (tb *TokenBucket) Consume() bool {
	tb.mu.Lock()
	defer tb.mu.Unlock()
	tb.refill()
	if tb.available < 1 {
		return false
	}
	tb.available--
	return true
}

// Available returns the current number of available tokens (after
// refilling).
func (tb *TokenBucket) Available() int {
	tb.mu.Lock()
	defer tb.mu.Unlock()
	tb.refill()
	return int(tb.available)
}

// Wait blocks until a token is available or ctx is cancelled.  It
// returns ctx.Err() on cancellation, nil on success.
func (tb *TokenBucket) Wait(ctx context.Context) error {
	for {
		if tb.Consume() {
			return nil
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(time.Duration(tb.refillRate)):
		}
	}
}
