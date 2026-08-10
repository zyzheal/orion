package dr

import "testing"

func TestDRCounter(t *testing.T) {
    c := NewDRCounter()
    c.Increment()
    if c.Value() != 1 { t.Fatal("counter should be 1") }
    c.Increment()
    c.Decrement()
    if c.Value() != 1 { t.Fatal("counter should remain 1") }
    c.Reset()
    if c.Value() != 0 { t.Fatal("counter should be 0") }
}

func TestDRBuffer(t *testing.T) {
    b := NewDRBuffer(2)
    b.Push("a")
    b.Push("b")
    if b.Push("c") { t.Fatal("push should fail when full") }
    if b.Len() != 2 { t.Fatal("len should be 2") }
    item, ok := b.Pop()
    if !ok || item != "a" { t.Fatal("pop should return a") }
}

func TestDRConfigStore(t *testing.T) {
    cs := NewDRConfigStore()
    cs.Set("db", "host", "localhost")
    val, ok := cs.Get("db", "host")
    if !ok || val != "localhost" { t.Fatal("get should return localhost") }
}

func TestDRRateLimiter(t *testing.T) {
    rl := NewDRRateLimiter(2, 1.0)
    if !rl.Allow() { t.Fatal("first allow should succeed") }
    if !rl.Allow() { t.Fatal("second allow should succeed") }
    if rl.Allow() { t.Fatal("third allow should fail") }
}

func TestDRTimeoutConfig(t *testing.T) {
    tc := DefaultDRTimeoutConfig()
    if !tc.IsValid() { t.Fatal("default should be valid") }
}

func TestDRUnique(t *testing.T) {
    items := []string{"a", "b", "a", "c", "b"}
    result := DRUnique(items)
    if len(result) != 3 { t.Fatal("unique should remove dupes") }
}

func TestDRContains(t *testing.T) {
    items := []string{"a", "b", "c"}
    if !DRContains(items, "b") { t.Fatal("should find b") }
    if DRContains(items, "d") { t.Fatal("should not find d") }
}

func TestDRJoin(t *testing.T) {
    result := DRJoin([]string{"a", "b", "c"}, "-")
    if result != "a-b-c" { t.Fatal("join result mismatch") }
}
