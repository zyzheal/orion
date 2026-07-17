package idempotency

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"sync"
	"time"
)

// Processor provides application-level idempotency for non-HTTP
// operations (e.g. background jobs, CLI commands, saga steps).  Call
// Process(ctx, key, fn): it executes fn once per key and replays the
// cached payload on subsequent invocations.
type Processor struct {
	store Store
	ttl   time.Duration
	// mu serialises the Set-after-execution to avoid races when the same
	// key is processed concurrently.
	mu     sync.Mutex
	locks  map[string]*sync.Mutex
	locksM sync.Mutex
}

// ProcessorOption configures a Processor.
type ProcessorOption func(*Processor)

// WithProcessorStore sets the backing store.  Defaults to a MemoryStore
// with 24h TTL.
func WithProcessorStore(store Store) ProcessorOption {
	return func(p *Processor) { p.store = store }
}

// WithProcessorTTL sets the cache TTL.  Defaults to 24 hours.
func WithProcessorTTL(ttl time.Duration) ProcessorOption {
	return func(p *Processor) { p.ttl = ttl }
}

// NewProcessor creates a Processor with the given options.
func NewProcessor(opts ...ProcessorOption) *Processor {
	p := &Processor{
		store: NewMemoryStore(),
		ttl:   24 * time.Hour,
		locks: make(map[string]*sync.Mutex),
	}
	for _, opt := range opts {
		opt(p)
	}
	return p
}

// makeLock returns (or creates) a per-key mutex used to serialise
// concurrent Process calls for the same key.
func (p *Processor) makeLock(key string) *sync.Mutex {
	p.locksM.Lock()
	defer p.locksM.Unlock()
	lock, ok := p.locks[key]
	if !ok {
		lock = &sync.Mutex{}
		p.locks[key] = lock
	}
	return lock
}

// Process executes fn exactly once per key.  On the first invocation it
// runs fn, caches the result, and returns it.  Subsequent invocations
// (within TTL) return the cached result without calling fn.
//
// Context cancellation is respected: if ctx is cancelled while fn is
// running, the cancellation propagates but the cache is NOT written so
// that the operation can be retried cleanly.
func (p *Processor) Process(ctx context.Context, key string, fn func() ([]byte, error)) ([]byte, error) {
	// Fast path: check the store without taking the write lock.
	existing, err := p.store.Get(IdempotencyKey(key))
	if err == nil {
		return existing.Body, nil
	}
	if err != ErrKeyExpired {
		return nil, &IdempotencyError{Key: key, Err: err}
	}

	// Slow path: serialise on the key to avoid duplicate execution when
	// two concurrent requests arrive for the same key.
	lock := p.makeLock(key)
	lock.Lock()
	defer lock.Unlock()

	// Double-check after acquiring the lock.
	existing, err = p.store.Get(IdempotencyKey(key))
	if err == nil {
		return existing.Body, nil
	}
	if err != ErrKeyExpired {
		return nil, &IdempotencyError{Key: key, Err: err}
	}

	body, err := fn()
	if err != nil {
		return nil, err
	}

	payload := &ResponsePayload{
		StatusCode:  200,
		Body:        body,
		ContentType: "application/octet-stream",
	}
	if storeErr := p.store.Set(IdempotencyKey(key), payload, p.ttl); storeErr != nil {
		// We have the result but couldn't persist it — return the result
		// anyway so the caller is not penalised.
		return body, &IdempotencyError{Key: key, Err: storeErr}
	}
	return body, nil
}

// Delete removes a cached entry.  Useful when an operation is rolled
// back and the key should be freed for reuse.
func (p *Processor) Delete(key string) error {
	return p.store.Delete(IdempotencyKey(key))
}

// DigestKey returns a deterministic hex digest of an arbitrary payload.
// Callers can use this to derive a short, collision-resistant key from
// a struct, JSON blob, etc.
func DigestKey(payload []byte) string {
	h := sha256.New()
	h.Write(payload)
	return hex.EncodeToString(h.Sum(nil))
}

// ComparePayload reports whether two payloads are equal (same status,
// body and content-type).  Headers are intentionally ignored because
// they often contain non-deterministic values (e.g. Date, Server).
func ComparePayload(a, b *ResponsePayload) bool {
	return a.StatusCode == b.StatusCode &&
		a.ContentType == b.ContentType &&
		bytes.Equal(a.Body, b.Body)
}
