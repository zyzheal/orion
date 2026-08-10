package migration

import "testing"

func TestMigrationCounter(t *testing.T) {
    c := NewMigrationCounter()
    c.Increment()
    if c.Value() != 1 { t.Fatal("counter should be 1") }
    c.Increment()
    c.Decrement()
    if c.Value() != 1 { t.Fatal("counter should remain 1") }
    c.Reset()
    if c.Value() != 0 { t.Fatal("counter should be 0") }
}

func TestMigrationBuffer(t *testing.T) {
    b := NewMigrationBuffer(2)
    b.Push("a")
    b.Push("b")
    if b.Push("c") { t.Fatal("push should fail when full") }
    if b.Len() != 2 { t.Fatal("len should be 2") }
    item, ok := b.Pop()
    if !ok || item != "a" { t.Fatal("pop should return a") }
}

func TestMigrationConfigStore(t *testing.T) {
    cs := NewMigrationConfigStore()
    cs.Set("db", "host", "localhost")
    val, ok := cs.Get("db", "host")
    if !ok || val != "localhost" { t.Fatal("get should return localhost") }
}

func TestMigrationRateLimiter(t *testing.T) {
    rl := NewMigrationRateLimiter(2, 1.0)
    if !rl.Allow() { t.Fatal("first allow should succeed") }
    if !rl.Allow() { t.Fatal("second allow should succeed") }
    if rl.Allow() { t.Fatal("third allow should fail") }
}

func TestMigrationTimeoutConfig(t *testing.T) {
    tc := DefaultMigrationTimeoutConfig()
    if !tc.IsValid() { t.Fatal("default should be valid") }
}

func TestMigrationUnique(t *testing.T) {
    items := []string{"a", "b", "a", "c", "b"}
    result := MigrationUnique(items)
    if len(result) != 3 { t.Fatal("unique should remove dupes") }
}

func TestMigrationContains(t *testing.T) {
    items := []string{"a", "b", "c"}
    if !MigrationContains(items, "b") { t.Fatal("should find b") }
    if MigrationContains(items, "d") { t.Fatal("should not find d") }
}

func TestMigrationJoin(t *testing.T) {
    result := MigrationJoin([]string{"a", "b", "c"}, "-")
    if result != "a-b-c" { t.Fatal("join result mismatch") }
}
