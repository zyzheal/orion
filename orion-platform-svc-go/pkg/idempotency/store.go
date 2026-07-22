package idempotency

import (
	"context"
	"encoding/json"
	"sync"
	"time"
)

// IdempotencyKey is an opaque key that identifies an idempotent operation.
type IdempotencyKey string

// ResponsePayload holds the response that a successful idempotent operation
// produced.  The middleware/processor caches this so that later requests
// with the same key can replay it without re-executing the operation.
type ResponsePayload struct {
	StatusCode  int
	Headers     map[string][]string
	Body        []byte
	ContentType string
}

// Store is the backing store for cached response payloads.
type Store interface {
	Get(key IdempotencyKey) (*ResponsePayload, error)
	Set(key IdempotencyKey, payload *ResponsePayload, ttl time.Duration) error
	Delete(key IdempotencyKey) error
}

// ---- In-memory store (sync.Map fallback when Redis is unavailable) ----

type memoryEntry struct {
	payload *ResponsePayload
	expire  time.Time
}

// MemoryStore is a thread-safe in-memory implementation of Store.  It is
// the default used by NewDefaultStore() and by Gin middleware / Processor
// when no custom store is provided.
type MemoryStore struct {
	mu    sync.RWMutex
	items map[IdempotencyKey]memoryEntry
}

// NewMemoryStore creates a new empty MemoryStore.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		items: make(map[IdempotencyKey]memoryEntry),
	}
}

func (s *MemoryStore) Get(key IdempotencyKey) (*ResponsePayload, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	entry, ok := s.items[key]
	if !ok {
		return nil, ErrKeyExpired
	}
	if time.Now().After(entry.expire) {
		// Defer deletion to the next write to avoid taking the write lock.
		return nil, ErrKeyExpired
	}
	return entry.payload, nil
}

func (s *MemoryStore) Set(key IdempotencyKey, payload *ResponsePayload, ttl time.Duration) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.items[key] = memoryEntry{
		payload: payload,
		expire:  time.Now().Add(ttl),
	}
	return nil
}

func (s *MemoryStore) Delete(key IdempotencyKey) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.items, key)
	return nil
}

// Compact removes all expired entries.  Callers may invoke this on a
// background goroutine to bound memory usage.
func (s *MemoryStore) Compact() int {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	removed := 0
	for key, entry := range s.items {
		if now.After(entry.expire) {
			delete(s.items, key)
			removed++
		}
	}
	return removed
}

// CompactBackground starts a background goroutine that runs Compact()
// every interval and stops when ctx is cancelled.
func (s *MemoryStore) CompactBackground(ctx context.Context, interval time.Duration) <-chan struct{} {
	done := make(chan struct{})
	go func() {
		defer close(done)
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				s.Compact()
			}
		}
	}()
	return done
}

// ---- JSON marshal helpers ----

// MarshalPayload serialises a ResponsePayload to JSON bytes for storage
// in external stores such as Redis.
func MarshalPayload(payload *ResponsePayload) ([]byte, error) {
	// Use the standard library; the struct only contains JSON-safe types.
	return json.Marshal(payload)
}

// UnmarshalPayload reconstructs a ResponsePayload from JSON bytes.
func UnmarshalPayload(data []byte) (*ResponsePayload, error) {
	payload := &ResponsePayload{}
	if err := json.Unmarshal(data, payload); err != nil {
		return nil, &IdempotencyError{Err: err}
	}
	return payload, nil
}
