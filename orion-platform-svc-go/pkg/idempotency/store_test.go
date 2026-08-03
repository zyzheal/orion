package idempotency

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"
)

func TestMemoryStore(t *testing.T) {
	store := NewMemoryStore()

	payload := &ResponsePayload{
		StatusCode: 200,
		Headers:    map[string][]string{"Content-Type": {"application/json"}},
		Body:       []byte(`{"ok":true}`),
		ContentType: "application/json",
	}

	// Set + Get.
	if err := store.Set(IdempotencyKey("k1"), payload, time.Hour); err != nil {
		t.Fatal(err)
	}
	got, err := store.Get(IdempotencyKey("k1"))
	if err != nil {
		t.Fatal(err)
	}
	if got.StatusCode != 200 || string(got.Body) != `{"ok":true}` {
		t.Fatalf("unexpected payload: %+v", got)
	}

	// Missing key.
	_, err = store.Get(IdempotencyKey("nope"))
	if err != ErrKeyExpired {
		t.Fatalf("expected ErrKeyExpired, got %v", err)
	}

	// Delete.
	if err := store.Delete(IdempotencyKey("k1")); err != nil {
		t.Fatal(err)
	}
	_, err = store.Get(IdempotencyKey("k1"))
	if err != ErrKeyExpired {
		t.Fatalf("expected ErrKeyExpired after delete, got %v", err)
	}
}

func TestMemoryStoreExpiration(t *testing.T) {
	store := NewMemoryStore()
	_ = store.Set(IdempotencyKey("e1"), &ResponsePayload{StatusCode: 200, Body: []byte("x")}, 50*time.Millisecond)

	// Immediately available.
	if _, err := store.Get(IdempotencyKey("e1")); err != nil {
		t.Fatal(err)
	}

	// Wait for expiry.
	time.Sleep(100 * time.Millisecond)
	_, err := store.Get(IdempotencyKey("e1"))
	if err != ErrKeyExpired {
		t.Fatalf("expected ErrKeyExpired, got %v", err)
	}

	// Compact should remove it.
	removed := store.Compact()
	if removed != 1 {
		t.Fatalf("expected 1 removed, got %d", removed)
	}
}

func TestMemoryStoreConcurrent(t *testing.T) {
	store := NewMemoryStore()

	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(3)
		k := IdempotencyKey("c")
		go func() { _ = store.Set(k, &ResponsePayload{StatusCode: 200}, time.Hour); wg.Done() }()
		go func() { _, _ = store.Get(k); wg.Done() }()
		go func() { _ = store.Delete(k); wg.Done() }()
	}
	wg.Wait()
}

func TestCompactBackground(t *testing.T) {
	store := NewMemoryStore()
	_ = store.Set(IdempotencyKey("bg"), &ResponsePayload{StatusCode: 200}, 50*time.Millisecond)
	ctx, cancel := context.WithCancel(t.Context())
	done := store.CompactBackground(ctx, 25*time.Millisecond)
	time.Sleep(100 * time.Millisecond)
	cancel()
	<-done
	// Entry should have been compacted.
	_, err := store.Get(IdempotencyKey("bg"))
	if err != ErrKeyExpired {
		t.Fatalf("expected expired, got %v", err)
	}
}

func TestMarshalUnmarshalPayload(t *testing.T) {
	orig := &ResponsePayload{
		StatusCode:  418,
		Headers:     map[string][]string{"X-Foo": {"bar", "baz"}},
		Body:        []byte("🫡"),
		ContentType: "application/custom",
	}
	data, err := MarshalPayload(orig)
	if err != nil {
		t.Fatal(err)
	}
	got, err := UnmarshalPayload(data)
	if err != nil {
		t.Fatal(err)
	}
	if got.StatusCode != orig.StatusCode || got.ContentType != orig.ContentType || string(got.Body) != string(orig.Body) {
		t.Fatalf("round-trip mismatch: %+v", got)
	}
}

func TestErrors(t *testing.T) {
	inner := errors.New("timeout")
	wrapped := &IdempotencyError{Key: "k", Err: inner}

	if errors.Is(wrapped, &IdempotencyError{}) != true {
		t.Fatal("errors.Is failed for IdempotencyError")
	}
	if errors.Is(wrapped, inner) != true {
		t.Fatal("errors.Is failed for inner error")
	}
	if unwrapped := wrapped.Unwrap(); unwrapped != inner {
		t.Fatal("Unwrap returned wrong error")
	}
	if wrapped.Error() == "" {
		t.Fatal("Error() returned empty string")
	}
}
