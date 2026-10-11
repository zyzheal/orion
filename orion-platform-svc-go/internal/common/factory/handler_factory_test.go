package factory

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
)

// stringHandler is a minimal Handler[string] for testing.
type stringHandler struct {
	name   string
	handle func(context.Context, string) error
}

func (h *stringHandler) Type() string { return h.name }

func (h *stringHandler) Handle(_ context.Context, ev string) error {
	if h.handle == nil {
		return nil
	}
	return h.handle(context.Background(), ev)
}

func TestNewHandlerFactory_Empty(t *testing.T) {
	f := NewHandlerFactory[string]()
	if f.Count() != 0 {
		t.Fatalf("expected empty factory, got count=%d", f.Count())
	}
	if _, ok := f.Get("missing"); ok {
		t.Fatal("expected Get on empty factory to return ok=false")
	}
	if list := f.List(); len(list) != 0 {
		t.Fatalf("expected empty List, got %v", list)
	}
}

func TestRegister_And_Get(t *testing.T) {
	f := NewHandlerFactory[string]()
	h := &stringHandler{name: "type-a"}
	if err := f.Register(h); err != nil {
		t.Fatalf("Register failed: %v", err)
	}
	if f.Count() != 1 {
		t.Fatalf("expected count=1, got %d", f.Count())
	}
	got, ok := f.Get("type-a")
	if !ok {
		t.Fatal("expected Get to find registered handler")
	}
	if got != h {
		t.Fatal("expected Get to return the same handler instance")
	}
}

func TestRegister_DuplicateReturnsError(t *testing.T) {
	f := NewHandlerFactory[string]()
	h1 := &stringHandler{name: "type-a"}
	h2 := &stringHandler{name: "type-a"} // same type, different instance
	if err := f.Register(h1); err != nil {
		t.Fatalf("first Register failed: %v", err)
	}
	if err := f.Register(h2); err == nil {
		t.Fatal("expected duplicate Register to fail")
	} else if err.Error() == "" {
		t.Fatal("expected non-empty error message for duplicate")
	}
	if !f.Has("type-a") {
		t.Fatal("existing handler should still be present after failed duplicate")
	}
	if f.Count() != 1 {
		t.Fatalf("expected count=1 after failed duplicate, got %d", f.Count())
	}
}

func TestRegister_NilAndEmptyTypeError(t *testing.T) {
	f := NewHandlerFactory[string]()
	if err := f.Register(nil); err == nil {
		t.Fatal("expected Register(nil) to fail")
	}
	if err := f.Register(&stringHandler{name: ""}); err == nil {
		t.Fatal("expected Register with empty Type() to fail")
	}
}

func TestRegisterIfAbsent_SkipsDuplicates(t *testing.T) {
	f := NewHandlerFactory[string]()
	h1 := &stringHandler{name: "type-a"}
	h2 := &stringHandler{name: "type-a"}
	if !f.RegisterIfAbsent(h1) {
		t.Fatal("first RegisterIfAbsent should add")
	}
	if f.RegisterIfAbsent(h2) {
		t.Fatal("second RegisterIfAbsent should skip duplicate")
	}
	got, _ := f.Get("type-a")
	if got != h1 {
		t.Fatal("expected h1 to remain, got h2 (duplicate overwrote)")
	}
}

func TestUnregister_RemovesAndPreservesOrder(t *testing.T) {
	f := NewHandlerFactory[string]()
	for _, name := range []string{"a", "b", "c", "d"} {
		if err := f.Register(&stringHandler{name: name}); err != nil {
			t.Fatalf("register %s failed: %v", name, err)
		}
	}
	if !f.Unregister("b") {
		t.Fatal("expected Unregister(b) to return true")
	}
	if f.Unregister("b") {
		t.Fatal("expected second Unregister(b) to return false")
	}
	got := f.List()
	if len(got) != 3 {
		t.Fatalf("expected 3 after unregister, got %d: %v", len(got), got)
	}
	// Order preserved for the remaining entries.
	expected := []string{"a", "c", "d"}
	for i, e := range expected {
		if got[i] != e {
			t.Errorf("List()[%d]=%s, want %s (full list: %v)", i, got[i], e, got)
		}
	}
}

func TestList_ReturnsCopy(t *testing.T) {
	f := NewHandlerFactory[string]()
	f.Register(&stringHandler{name: "a"})
	list1 := f.List()
	_ = list1[0] // panic would indicate underlying map mutation
	// Mutate our copy, verify factory is unaffected.
	list1[0] = "mutated"
	list2 := f.List()
	if list2[0] == "mutated" {
		t.Fatal("List() should return a copy, not a reference")
	}
}

func TestDispatch_CallsHandler(t *testing.T) {
	f := NewHandlerFactory[string]()
	var got string
	f.Register(&stringHandler{
		name: "type-a",
		handle: func(_ context.Context, ev string) error {
			got = ev
			return nil
		},
	})
	if err := f.Dispatch(context.Background(), "hello", "type-a"); err != nil {
		t.Fatalf("Dispatch failed: %v", err)
	}
	if got != "hello" {
		t.Fatalf("expected handler to receive 'hello', got %q", got)
	}
}

func TestDispatch_MissingHandlerWrapsErrNoHandler(t *testing.T) {
	f := NewHandlerFactory[string]()
	err := f.Dispatch(context.Background(), "hello", "nope")
	if !errors.Is(err, ErrNoHandler) {
		t.Fatalf("expected errors.Is(err, ErrNoHandler) to be true, got: %v", err)
	}
}

func TestDispatch_HandlerErrorPropagates(t *testing.T) {
	f := NewHandlerFactory[string]()
	sentinel := errors.New("downstream")
	f.Register(&stringHandler{
		name:   "type-a",
		handle: func(_ context.Context, _ string) error { return sentinel },
	})
	err := f.Dispatch(context.Background(), "hello", "type-a")
	if !errors.Is(err, sentinel) {
		t.Fatalf("expected handler error to propagate, got: %v", err)
	}
}

// TestConcurrentRegisterAndGet stresses the RWMutex. If any access
// races, the -race detector will surface it.
func TestConcurrentRegisterAndGet(t *testing.T) {
	f := NewHandlerFactory[string]()
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			name := fmt.Sprintf("type-%d", i)
			_ = f.Register(&stringHandler{name: name})
			_, _ = f.Get(name)
			_ = f.List()
			_ = f.Count()
		}(i)
	}
	wg.Wait()
	if f.Count() != 20 {
		t.Fatalf("expected 20 handlers, got %d", f.Count())
	}
}

// TestCountMonotonicWithRegister verifies Count() grows monotonically
// as handlers are added and shrinks on Unregister.
func TestCountMonotonicWithRegister(t *testing.T) {
	f := NewHandlerFactory[string]()
	for i := 0; i < 5; i++ {
		if err := f.Register(&stringHandler{name: fmt.Sprintf("type-%d", i)}); err != nil {
			t.Fatalf("register %d failed: %v", i, err)
		}
		if f.Count() != i+1 {
			t.Fatalf("after %d registers expected count=%d, got %d", i+1, i+1, f.Count())
		}
	}
	for i := 0; i < 3; i++ {
		f.Unregister(fmt.Sprintf("type-%d", i))
		if f.Count() != 5-i-1 {
			t.Fatalf("after %d unregisters expected count=%d, got %d", i+1, 5-i-1, f.Count())
		}
	}
}

// TestDispatchUsesErrNoHandlerSentinel is the specific ADR-012 §3.2.3
// test contract: verify Dispatch on a missing key returns ErrNoHandler
// via errors.Is so callers can distinguish missing from other failures.
func TestDispatchUsesErrNoHandlerSentinel(t *testing.T) {
	f := NewHandlerFactory[string]()
	err := f.Dispatch(context.Background(), "event", "nonexistent")
	if err == nil {
		t.Fatal("expected Dispatch to error for missing handler")
	}
	if errors.Is(err, ErrNoHandler) {
		// Good — this is the contract ADR-012 §3.2.3 specifies.
		return
	}
	t.Fatalf("errors.Is(err, ErrNoHandler) returned false for: %v", err)
}

// TestHandlerInterfaceSatisfaction verifies the minimal Handler
// implementation satisfies the interface — a compile-time guard.
func TestHandlerInterfaceSatisfaction(t *testing.T) {
	var _ Handler[string] = (*stringHandler)(nil)
	var _ Handler[map[string]any] = (*typedAnyHandler)(nil)
}

// typedAnyHandler implements Handler[map[string]any] for compile-time
// interface check. Never actually registered.
type typedAnyHandler struct{}

func (h *typedAnyHandler) Type() string                            { return "any" }
func (h *typedAnyHandler) Handle(_ context.Context, _ map[string]any) error {
	return nil
}

// BenchmarkRegister measures the raw register cost — this is a
// sanity floor so someone doesn't accidentally add a mutex upgrade to
// Register (which would serialize every Register call).
func BenchmarkRegister(b *testing.B) {
	f := NewHandlerFactory[string]()
	var n int32
	for i := 0; i < b.N; i++ {
		name := fmt.Sprintf("type-%d", atomic.AddInt32(&n, 1))
		_ = f.Register(&stringHandler{name: name})
	}
}

// BenchmarkGet measures the read path. Should be near-lockfree.
func BenchmarkGet(b *testing.B) {
	f := NewHandlerFactory[string]()
	f.Register(&stringHandler{name: "type-a"})
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = f.Get("type-a")
	}
}
