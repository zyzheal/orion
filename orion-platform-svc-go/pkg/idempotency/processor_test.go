package idempotency

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"
)

func TestProcessor(t *testing.T) {
	p := NewProcessor()
	var count int64

	fn := func() ([]byte, error) {
		atomic.AddInt64(&count, 1)
		return []byte("result"), nil
	}

	// First call executes.
	b1, err := p.Process(context.Background(), "p1", fn)
	if err != nil {
		t.Fatal(err)
	}
	if string(b1) != "result" {
		t.Fatalf("unexpected: %s", b1)
	}

	// Second call replays cache.
	b2, err := p.Process(context.Background(), "p1", fn)
	if err != nil {
		t.Fatal(err)
	}
	if string(b2) != "result" {
		t.Fatalf("unexpected: %s", b2)
	}

	if atomic.LoadInt64(&count) != 1 {
		t.Fatalf("expected 1 execution, got %d", atomic.LoadInt64(&count))
	}
}

func TestProcessorDifferentKeys(t *testing.T) {
	p := NewProcessor()
	var count int64
	fn := func() ([]byte, error) {
		atomic.AddInt64(&count, 1)
		return []byte("x"), nil
	}
	_, _ = p.Process(context.Background(), "a", fn)
	_, _ = p.Process(context.Background(), "b", fn)
	if atomic.LoadInt64(&count) != 2 {
		t.Fatalf("expected 2, got %d", atomic.LoadInt64(&count))
	}
}

func TestProcessorFnError(t *testing.T) {
	p := NewProcessor()
	fn := func() ([]byte, error) {
		return nil, errors.New("boom")
	}
	_, err := p.Process(context.Background(), "err", fn)
	if err == nil {
		t.Fatal("expected error")
	}
	// Error is NOT cached — second call should re-execute.
	_, err = p.Process(context.Background(), "err", fn)
	if err == nil {
		t.Fatal("expected error on retry")
	}
}

func TestProcessorDelete(t *testing.T) {
	p := NewProcessor()
	var count int64
	fn := func() ([]byte, error) {
		atomic.AddInt64(&count, 1)
		return []byte("y"), nil
	}
	_, _ = p.Process(context.Background(), "del", fn)
	_ = p.Delete("del")
	_, _ = p.Process(context.Background(), "del", fn) // re-runs
	if atomic.LoadInt64(&count) != 2 {
		t.Fatalf("expected 2 after delete+reprocess, got %d", atomic.LoadInt64(&count))
	}
}

func TestProcessorConcurrent(t *testing.T) {
	p := NewProcessor()
	var count int64
	fn := func() ([]byte, error) {
		atomic.AddInt64(&count, 1)
		return []byte("c"), nil
	}
	var done int64
	for i := 0; i < 50; i++ {
		go func() {
			_, _ = p.Process(context.Background(), "conc", fn)
			atomic.AddInt64(&done, 1)
		}()
	}
	for atomic.LoadInt64(&done) < 50 {
		time.Sleep(time.Millisecond)
	}
	if atomic.LoadInt64(&count) != 1 {
		t.Fatalf("concurrent calls should execute once, got %d", atomic.LoadInt64(&count))
	}
}

func TestDigestKey(t *testing.T) {
	d1 := DigestKey([]byte("hello"))
	d2 := DigestKey([]byte("hello"))
	if d1 != d2 {
		t.Fatal("same input should yield same digest")
	}
	d3 := DigestKey([]byte("world"))
	if d1 == d3 {
		t.Fatal("different input should yield different digest")
	}
}

func TestComparePayload(t *testing.T) {
	a := &ResponsePayload{StatusCode: 200, ContentType: "json", Body: []byte("x")}
	b := &ResponsePayload{StatusCode: 200, ContentType: "json", Body: []byte("x")}
	c := &ResponsePayload{StatusCode: 200, ContentType: "json", Body: []byte("y")}
	d := &ResponsePayload{StatusCode: 201, ContentType: "json", Body: []byte("x")}

	if !ComparePayload(a, b) {
		t.Fatal("should be equal")
	}
	if ComparePayload(a, c) {
		t.Fatal("different body should differ")
	}
	if ComparePayload(a, d) {
		t.Fatal("different status should differ")
	}
}

func TestProcessorContextCancelled(t *testing.T) {
	p := NewProcessor()
	fn := func() ([]byte, error) {
		// Slow operation.
		time.Sleep(200 * time.Millisecond)
		return []byte("late"), nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()

	done := make(chan struct{})
	go func() {
		_, _ = p.Process(ctx, "ctx", fn)
		close(done)
	}()
	<-done
}
