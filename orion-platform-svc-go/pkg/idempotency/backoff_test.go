package idempotency

import (
	"testing"
	"time"
)

func TestExponentialBackoff(t *testing.T) {
	bo := NewExponentialBackoff(100*time.Millisecond, time.Second)
	d1 := bo.Next()
	d2 := bo.Next()
	d3 := bo.Next()
	d4 := bo.Next()

	if d1 != 100*time.Millisecond {
		t.Fatalf("expected 100ms, got %v", d1)
	}
	if d2 != 200*time.Millisecond {
		t.Fatalf("expected 200ms, got %v", d2)
	}
	// Should cap at max.
	if d3 > time.Second {
		t.Fatalf("exceeded max: %v", d3)
	}
	if d4 > time.Second {
		t.Fatalf("exceeded max: %v", d4)
	}
}

func TestExponentialBackoffReset(t *testing.T) {
	bo := NewExponentialBackoff(50*time.Millisecond, time.Hour)
	_ = bo.Next()
	_ = bo.Next()
	bo.Reset()
	d := bo.Next()
	if d != 50*time.Millisecond {
		t.Fatalf("expected 50ms after reset, got %v", d)
	}
}

func TestExponentialBackoffCustomMultiplier(t *testing.T) {
	bo := NewExponentialBackoffWithMultiplier(100*time.Millisecond, time.Hour, 3.0)
	d1 := bo.Next()
	d2 := bo.Next()
	if d1 != 100*time.Millisecond {
		t.Fatalf("expected 100ms, got %v", d1)
	}
	if d2 != 300*time.Millisecond {
		t.Fatalf("expected 300ms (3x), got %v", d2)
	}
}

func TestJitteredBackoff(t *testing.T) {
	base := NewFixedBackoff(1000 * time.Millisecond)
	jit := NewJitteredBackoff(base, 0.5)

	for i := 0; i < 20; i++ {
		d := jit.Next()
		if d < 500*time.Millisecond || d > 1500*time.Millisecond {
			t.Fatalf("jitter out of range: %v", d)
		}
	}
}

func TestJitteredBackoffZeroFactor(t *testing.T) {
	base := NewFixedBackoff(1000 * time.Millisecond)
	jit := NewJitteredBackoff(base, 0)
	d := jit.Next()
	if d != 1000*time.Millisecond {
		t.Fatalf("zero jitter should equal base: %v", d)
	}
}

func TestFixedBackoff(t *testing.T) {
	bo := NewFixedBackoff(42 * time.Millisecond)
	for i := 0; i < 5; i++ {
		if d := bo.Next(); d != 42*time.Millisecond {
			t.Fatalf("expected 42ms, got %v", d)
		}
	}
}
