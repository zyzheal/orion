package tenantutil

import "testing"

func TestTenantutilCounter(t *testing.T) {
    c := NewTenantutilCounter()
    c.Increment()
    if c.Value() != 1 { t.Fatal("counter should be 1") }
    c.Increment()
    c.Decrement()
    if c.Value() != 1 { t.Fatal("counter should remain 1") }
    c.Reset()
    if c.Value() != 0 { t.Fatal("counter should be 0") }
}

func TestTenantutilBuffer(t *testing.T) {
    b := NewTenantutilBuffer(2)
    b.Push("a")
    b.Push("b")
    if b.Push("c") { t.Fatal("push should fail when full") }
    if b.Len() != 2 { t.Fatal("len should be 2") }
    item, ok := b.Pop()
    if !ok || item != "a" { t.Fatal("pop should return a") }
}

func TestTenantutilConfigStore(t *testing.T) {
    cs := NewTenantutilConfigStore()
    cs.Set("db", "host", "localhost")
    val, ok := cs.Get("db", "host")
    if !ok || val != "localhost" { t.Fatal("get should return localhost") }
}

func TestTenantutilRateLimiter(t *testing.T) {
    rl := NewTenantutilRateLimiter(2, 1.0)
    if !rl.Allow() { t.Fatal("first allow should succeed") }
    if !rl.Allow() { t.Fatal("second allow should succeed") }
    if rl.Allow() { t.Fatal("third allow should fail") }
}

func TestTenantutilTimeoutConfig(t *testing.T) {
    tc := DefaultTenantutilTimeoutConfig()
    if !tc.IsValid() { t.Fatal("default should be valid") }
}

func TestTenantutilUnique(t *testing.T) {
    items := []string{"a", "b", "a", "c", "b"}
    result := TenantutilUnique(items)
    if len(result) != 3 { t.Fatal("unique should remove dupes") }
}

func TestTenantutilContains(t *testing.T) {
    items := []string{"a", "b", "c"}
    if !TenantutilContains(items, "b") { t.Fatal("should find b") }
    if TenantutilContains(items, "d") { t.Fatal("should not find d") }
}

func TestTenantutilJoin(t *testing.T) {
    result := TenantutilJoin([]string{"a", "b", "c"}, "-")
    if result != "a-b-c" { t.Fatal("join result mismatch") }
}
