package lock

import "testing"

func TestLockCounter(t *testing.T) {
    c := NewLockCounter()
    c.Increment()
    if c.Value() != 1 { t.Fatal("counter should be 1") }
    c.Increment()
    c.Decrement()
    if c.Value() != 1 { t.Fatal("counter should remain 1") }
    c.Reset()
    if c.Value() != 0 { t.Fatal("counter should be 0") }
}

func TestLockBuffer(t *testing.T) {
    b := NewLockBuffer(2)
    b.Push("a")
    b.Push("b")
    if b.Push("c") { t.Fatal("push should fail when full") }
    if b.Len() != 2 { t.Fatal("len should be 2") }
    item, ok := b.Pop()
    if !ok || item != "a" { t.Fatal("pop should return a") }
}

func TestLockConfigStore(t *testing.T) {
    cs := NewLockConfigStore()
    cs.Set("db", "host", "localhost")
    val, ok := cs.Get("db", "host")
    if !ok || val != "localhost" { t.Fatal("get should return localhost") }
}

func TestLockRateLimiter(t *testing.T) {
    rl := NewLockRateLimiter(2, 1.0)
    if !rl.Allow() { t.Fatal("first allow should succeed") }
    if !rl.Allow() { t.Fatal("second allow should succeed") }
    if rl.Allow() { t.Fatal("third allow should fail") }
}

func TestLockTimeoutConfig(t *testing.T) {
    tc := DefaultLockTimeoutConfig()
    if !tc.IsValid() { t.Fatal("default should be valid") }
}

func TestLockUnique(t *testing.T) {
    items := []string{"a", "b", "a", "c", "b"}
    result := LockUnique(items)
    if len(result) != 3 { t.Fatal("unique should remove dupes") }
}

func TestLockContains(t *testing.T) {
    items := []string{"a", "b", "c"}
    if !LockContains(items, "b") { t.Fatal("should find b") }
    if LockContains(items, "d") { t.Fatal("should not find d") }
}

func TestLockJoin(t *testing.T) {
    result := LockJoin([]string{"a", "b", "c"}, "-")
    if result != "a-b-c" { t.Fatal("join result mismatch") }
}
