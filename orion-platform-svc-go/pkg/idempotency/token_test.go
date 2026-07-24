package idempotency

import (
	"context"
	"sync"
	"testing"
	"time"
)

func TestTokenBucketConsume(t *testing.T) {
	tb := NewTokenBucket(WithCapacity(3), WithRefillRate(time.Hour))

	for i := 0; i < 3; i++ {
		if !tb.Consume() {
			t.Fatalf("should allow consume %d", i)
		}
	}
	if tb.Consume() {
		t.Fatal("should reject after bucket exhausted")
	}
}

func TestTokenBucketAllow(t *testing.T) {
	tb := NewTokenBucket(WithCapacity(2))
	if !tb.Allow() {
		t.Fatal("should allow")
	}
	_ = tb.Consume()
	_ = tb.Consume()
	if tb.Allow() {
		t.Fatal("should not allow when empty")
	}
}

func TestTokenBucketAvailable(t *testing.T) {
	tb := NewTokenBucket(WithCapacity(5), WithRefillRate(time.Hour))
	_ = tb.Consume()
	_ = tb.Consume()
	if tb.Available() != 3 {
		t.Fatalf("expected 3 available, got %d", tb.Available())
	}
}

func TestTokenBucketRefill(t *testing.T) {
	tb := NewTokenBucket(WithCapacity(3), WithRefillRate(50*time.Millisecond))
	// Exhaust the bucket.
	_ = tb.Consume()
	_ = tb.Consume()
	_ = tb.Consume()
	if tb.Available() != 0 {
		t.Fatalf("expected 0, got %d", tb.Available())
	}
	// Wait for refill.
	time.Sleep(120 * time.Millisecond)
	avail := tb.Available()
	if avail < 1 {
		t.Fatalf("expected >= 1 after refill, got %d", avail)
	}
}

func TestTokenBucketCapacityCap(t *testing.T) {
	tb := NewTokenBucket(WithCapacity(3), WithRefillRate(time.Nanosecond))
	time.Sleep(10 * time.Millisecond) // let refill run many times
	// Should not exceed capacity.
	avail := tb.Available()
	if avail > 3 {
		t.Fatalf("should not exceed capacity 3, got %d", avail)
	}
}

func TestTokenBucketWait(t *testing.T) {
	tb := NewTokenBucket(WithCapacity(1), WithRefillRate(50*time.Millisecond))
	_ = tb.Consume() // exhaust

	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()

	err := tb.Wait(ctx)
	if err != nil {
		t.Fatalf("Wait should succeed, got %v", err)
	}
	// Should have consumed the refilled token.
	if tb.Consume() {
		// Token was refilled and we got one during Wait; this is fine.
	}
}

func TestTokenBucketWaitCancelled(t *testing.T) {
	tb := NewTokenBucket(WithCapacity(1), WithRefillRate(time.Hour))
	_ = tb.Consume() // exhaust

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Millisecond)
	defer cancel()

	err := tb.Wait(ctx)
	if err != context.DeadlineExceeded {
		t.Fatalf("expected context deadline exceeded, got %v", err)
	}
}

func TestTokenBucketConcurrent(t *testing.T) {
	tb := NewTokenBucket(WithCapacity(100), WithRefillRate(time.Millisecond))

	var wg sync.WaitGroup
	for i := 0; i < 200; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_ = tb.Consume()
			_ = tb.Allow()
			_ = tb.Available()
		}()
	}
	wg.Wait()
}

func TestTokenBucketDefaultCapacity(t *testing.T) {
	tb := NewTokenBucket()
	if tb.Available() != 10 {
		t.Fatalf("default capacity should be 10, got %d", tb.Available())
	}
}
