// Package factory provides a generic thread-safe Factory[T] registry
// (ADR-012 §3.2.1). Domain code owns its own event/payload type T and
// registers Handler[T] implementations at wiring time; the service
// looks up the handler at dispatch time.
//
// Design intent:
//   - Generic: works for any T (alert events, deployment events, CI
//     events, etc.) without duplicating the same mutex/map boilerplate.
//   - Explicit registration: no init() side effects; callers pass a
//     *HandlerFactory[T] instance (not a global).
//   - Order-preserving: List() returns types in insertion order so
//     dispatch can be deterministic in multi-consumer scenarios.
//   - Safe for concurrent use: Register/Get/List are all guarded by an
//     RWMutex.
//
// This is the shared abstraction used by ADR-012 consumers; the existing
// notification-engine.NotifyHandlerFactory (domain-specific, non-generic)
// remains as-is.
package factory

import (
	"context"
	"fmt"
	"sync"
)

// Handler is the SPI a domain implementation must satisfy.
//
// Type() returns a stable string key used for registration and lookup.
// Handle() performs the actual work. The Handler is not responsible for
// error classification — callers may wrap returned errors.
type Handler[T any] interface {
	Type() string
	Handle(ctx context.Context, event T) error
}

// HandlerFactory is a thread-safe registry mapping a Type() key to a
// Handler[T]. The zero value is not usable — call NewHandlerFactory to
// allocate the map.
type HandlerFactory[T any] struct {
	mu       sync.RWMutex
	handlers map[string]Handler[T]
	order    []string
}

// NewHandlerFactory allocates a factory with an empty registry.
func NewHandlerFactory[T any]() *HandlerFactory[T] {
	return &HandlerFactory[T]{
		handlers: make(map[string]Handler[T]),
	}
}

// Register adds a handler to the registry. Fails on duplicate type key.
// Concurrent Register calls are serialized via the write lock.
func (f *HandlerFactory[T]) Register(h Handler[T]) error {
	if h == nil {
		return fmt.Errorf("factory: cannot register nil handler")
	}
	typeKey := h.Type()
	if typeKey == "" {
		return fmt.Errorf("factory: handler.Type() returned empty string")
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	if _, exists := f.handlers[typeKey]; exists {
		return fmt.Errorf("factory: duplicate handler type: %q", typeKey)
	}
	f.handlers[typeKey] = h
	f.order = append(f.order, typeKey)
	return nil
}

// RegisterIfAbsent registers the handler only if no handler of the same
// type is currently registered. Returns true if the handler was added,
// false if it was skipped.
func (f *HandlerFactory[T]) RegisterIfAbsent(h Handler[T]) bool {
	if h == nil {
		return false
	}
	typeKey := h.Type()
	if typeKey == "" {
		return false
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	if _, exists := f.handlers[typeKey]; exists {
		return false
	}
	f.handlers[typeKey] = h
	f.order = append(f.order, typeKey)
	return true
}

// Get returns the handler for the given type key. ok=false if not found.
func (f *HandlerFactory[T]) Get(typeKey string) (Handler[T], bool) {
	f.mu.RLock()
	defer f.mu.RUnlock()
	h, ok := f.handlers[typeKey]
	return h, ok
}

// Unregister removes the handler for typeKey. Returns true if it was
// present. Handlers that were referenced before the call still hold a
// pointer to the removed Handler[T]; callers should not reuse the
// returned value after Unregister.
func (f *HandlerFactory[T]) Unregister(typeKey string) bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	if _, exists := f.handlers[typeKey]; !exists {
		return false
	}
	delete(f.handlers, typeKey)
	// Rebuild order slice, preserving relative order of remaining types.
	out := f.order[:0]
	for _, k := range f.order {
		if k != typeKey {
			out = append(out, k)
		}
	}
	f.order = out
	return true
}

// Has reports whether a handler is registered for typeKey.
func (f *HandlerFactory[T]) Has(typeKey string) bool {
	f.mu.RLock()
	defer f.mu.RUnlock()
	_, ok := f.handlers[typeKey]
	return ok
}

// List returns all registered type keys in registration order. The
// returned slice is a copy — callers may mutate it without affecting
// the factory.
func (f *HandlerFactory[T]) List() []string {
	f.mu.RLock()
	defer f.mu.RUnlock()
	out := make([]string, len(f.order))
	copy(out, f.order)
	return out
}

// Count returns the number of registered handlers.
func (f *HandlerFactory[T]) Count() int {
	f.mu.RLock()
	defer f.mu.RUnlock()
	return len(f.handlers)
}

// ErrNoHandler is returned by Dispatch when the factory has no handler
// registered for the requested type key. Callers can check with
// errors.Is(err, ErrNoHandler) to distinguish "missing" from other
// dispatch failures (the type key is preserved in the message via %w).
var ErrNoHandler = fmt.Errorf("factory: no handler")

// Dispatch is a convenience helper that looks up the handler for the
// given type key and invokes it. Wraps ErrNoHandler when no handler is
// registered, so errors.Is(err, ErrNoHandler) still matches.
func (f *HandlerFactory[T]) Dispatch(ctx context.Context, event T, typeKey string) error {
	h, ok := f.Get(typeKey)
	if !ok {
		return fmt.Errorf("%w: %q", ErrNoHandler, typeKey)
	}
	return h.Handle(ctx, event)
}
