package handler

import "testing"

func TestHandlerCounter(t *testing.T) {
    c := NewHandlerCounter()
    c.Increment()
    if c.Value() != 1 { t.Fatal("counter should be 1") }
    c.Increment()
    c.Decrement()
    if c.Value() != 1 { t.Fatal("counter should remain 1") }
    c.Reset()
    if c.Value() != 0 { t.Fatal("counter should be 0") }
}

func TestHandlerBuffer(t *testing.T) {
    b := NewHandlerBuffer(2)
    b.Push("a")
    b.Push("b")
    if b.Push("c") { t.Fatal("push should fail when full") }
    if b.Len() != 2 { t.Fatal("len should be 2") }
    item, ok := b.Pop()
    if !ok || item != "a" { t.Fatal("pop should return a") }
}

func TestHandlerConfigStore(t *testing.T) {
    cs := NewHandlerConfigStore()
    cs.Set("db", "host", "localhost")
    val, ok := cs.Get("db", "host")
    if !ok || val != "localhost" { t.Fatal("get should return localhost") }
}

func TestHandlerRateLimiter(t *testing.T) {
    rl := NewHandlerRateLimiter(2, 1.0)
    if !rl.Allow() { t.Fatal("first allow should succeed") }
    if !rl.Allow() { t.Fatal("second allow should succeed") }
    if rl.Allow() { t.Fatal("third allow should fail") }
}

func TestHandlerTimeoutConfig(t *testing.T) {
    tc := DefaultHandlerTimeoutConfig()
    if !tc.IsValid() { t.Fatal("default should be valid") }
}

func TestHandlerUnique(t *testing.T) {
    items := []string{"a", "b", "a", "c", "b"}
    result := HandlerUnique(items)
    if len(result) != 3 { t.Fatal("unique should remove dupes") }
}

func TestHandlerContains(t *testing.T) {
    items := []string{"a", "b", "c"}
    if !HandlerContains(items, "b") { t.Fatal("should find b") }
    if HandlerContains(items, "d") { t.Fatal("should not find d") }
}

func TestHandlerJoin(t *testing.T) {
    result := HandlerJoin([]string{"a", "b", "c"}, "-")
    if result != "a-b-c" { t.Fatal("join result mismatch") }
}
