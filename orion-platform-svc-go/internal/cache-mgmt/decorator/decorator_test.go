package decorator

import (
	"reflect"
	"sync"
	"testing"
	"time"
)

// ---------------------------------------------------------------------------
// Pure functions used as test subjects
// ---------------------------------------------------------------------------

func add(a, b int) (int, error) {
	return a + b, nil
}

func multiply(a, b int) int {
	return a * b
}

func getUserName(id string) (string, error) {
	return "user-" + id, nil
}

func flaky(_ string) (string, error) {
	return "", nil
}

func triple(a, b, c int) (int, error) {
	return a + b + c, nil
}

// simpleMemoryBackend is a minimal CacheBackend for tests (wraps LRUCache).
type simpleMemoryBackend struct {
	c *LRUCache
}

func (b *simpleMemoryBackend) Get(key string) (interface{}, bool) {
	return b.c.Get(key)
}

func (b *simpleMemoryBackend) Set(key string, value interface{}) error {
	b.c.Set(key, value)
	return nil
}

func (b *simpleMemoryBackend) Delete(key string) {
	b.c.Delete(key)
}

func (b *simpleMemoryBackend) Len() int {
	return b.c.Len()
}

func (b *simpleMemoryBackend) Clear() {
	b.c.Clear()
}

// ---------------------------------------------------------------------------
// MethodCache tests
// ---------------------------------------------------------------------------

func TestMethodCache_HitMiss(t *testing.T) {
	cfg := CacheConfig{
		Name:     "add",
		TTL:      5 * time.Minute,
		MaxSize:  10,
		Eviction: EvictionLRU,
	}
	backend := &simpleMemoryBackend{c: NewLRUCache(100)}
	mc := NewMethodCache("add", add, cfg, backend)

	// First call: cache miss.
	result, err := mc.Invoke(2, 3)
	if err != nil {
		t.Fatal("first call should not error:", err)
	}
	if len(result) != 2 {
		t.Fatalf("expected 2 results, got %d", len(result))
	}
	sum := result[0].Int()
	if sum != 5 {
		t.Fatalf("expected 5, got %d", sum)
	}

	stats := mc.Stats()
	if stats.Misses != 1 {
		t.Fatalf("expected 1 miss, got %d", stats.Misses)
	}

	// Second call: cache hit.
	result, err = mc.Invoke(2, 3)
	if err != nil {
		t.Fatal("second call should not error:", err)
	}
	if result[0].Int() != 5 {
		t.Fatalf("expected 5, got %d", result[0].Int())
	}

	stats = mc.Stats()
	if stats.Hits != 1 {
		t.Fatalf("expected 1 hit, got %d", stats.Hits)
	}
}

func TestMethodCache_DifferentKeys(t *testing.T) {
	cfg := CacheConfig{
		Name:     "add",
		MaxSize:  100,
		Eviction: EvictionLRU,
	}
	backend := &simpleMemoryBackend{c: NewLRUCache(100)}
	mc := NewMethodCache("add", add, cfg, backend)

	_, _ = mc.Invoke(1, 2)
	_, _ = mc.Invoke(1, 2) // hit
	_, _ = mc.Invoke(3, 4) // miss — different key

	stats := mc.Stats()
	if stats.Hits != 1 {
		t.Fatalf("expected 1 hit, got %d", stats.Hits)
	}
	if stats.Misses != 2 {
		t.Fatalf("expected 2 misses, got %d", stats.Misses)
	}
}

func TestMethodCache_SingleReturnValue(t *testing.T) {
	cfg := CacheConfig{
		Name:     "multiply",
		MaxSize:  10,
		Eviction: EvictionLRU,
	}
	backend := &simpleMemoryBackend{c: NewLRUCache(100)}
	mc := NewMethodCache("multiply", multiply, cfg, backend)

	result, err := mc.Invoke(3, 4)
	if err != nil {
		t.Fatal(err)
	}
	if len(result) != 1 || result[0].Int() != 12 {
		t.Fatalf("expected 12, got %v", result)
	}
}

func TestMethodCache_Disabled(t *testing.T) {
	cfg := CacheConfig{
		Name:    "add",
		MaxSize: 10,
		Disable: true, // caching disabled
	}
	backend := &simpleMemoryBackend{c: NewLRUCache(100)}
	mc := NewMethodCache("add", add, cfg, backend)

	mc.Invoke(1, 2)
	mc.Invoke(1, 2) // both should be misses
	stats := mc.Stats()
	if stats.Hits != 0 {
		t.Fatalf("expected 0 hits when disabled, got %d", stats.Hits)
	}
	if stats.Misses != 2 {
		t.Fatalf("expected 2 misses when disabled, got %d", stats.Misses)
	}
}

func TestMethodCache_Evict(t *testing.T) {
	cfg := CacheConfig{
		Name:     "add",
		MaxSize:  10,
		Eviction: EvictionLRU,
	}
	backend := &simpleMemoryBackend{c: NewLRUCache(100)}
	mc := NewMethodCache("add", add, cfg, backend)

	mc.Invoke(1, 2) // populate cache
	mc.Evict(1, 2)  // evict key

	stats := mc.Stats()
	if stats.Hits != 0 {
		t.Fatalf("expected 0 hits after evict, got %d", stats.Hits)
	}
}

func TestMethodCache_Invalidate(t *testing.T) {
	cfg := CacheConfig{
		Name:     "add",
		MaxSize:  10,
		Eviction: EvictionLRU,
	}
	backend := &simpleMemoryBackend{c: NewLRUCache(100)}
	mc := NewMethodCache("add", add, cfg, backend)

	mc.Invoke(1, 2)
	mc.Invoke(3, 4)
	mc.Invalidate()

	stats := mc.Stats()
	if stats.Hits != 0 || stats.Misses != 0 || stats.Sets != 0 {
		t.Fatalf("expected all-zero stats after invalidate, got %+v", stats)
	}
}

func TestMethodCache_Concurrent(t *testing.T) {
	cfg := CacheConfig{
		Name:     "add",
		MaxSize:  100,
		Eviction: EvictionLRU,
	}
	backend := &simpleMemoryBackend{c: NewLRUCache(1000)}
	mc := NewMethodCache("add", add, cfg, backend)

	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(2)
		go func(n int) {
			defer wg.Done()
			_, _ = mc.Invoke(n, n)
		}(i)
		go func(n int) {
			defer wg.Done()
			_, _ = mc.Invoke(n, n)
		}(i)
	}
	wg.Wait()
}

func TestMethodStats_HitRatio(t *testing.T) {
	s := MethodStats{Hits: 10, Misses: 10}
	if s.HitRatio() != 0.5 {
		t.Fatalf("expected 0.5, got %f", s.HitRatio())
	}
	s2 := MethodStats{Hits: 0, Misses: 0}
	if s2.HitRatio() != 0 {
		t.Fatalf("expected 0, got %f", s2.HitRatio())
	}
}

// ---------------------------------------------------------------------------
// KeyGenerator tests
// ---------------------------------------------------------------------------

func TestDefaultKeyGenerator(t *testing.T) {
	g := DefaultKeyGenerator()
	k1 := g.Key("hello", 123)
	if k1 == "" {
		t.Fatal("key should not be empty")
	}
	// Same args → same key.
	if k1 != g.Key("hello", 123) {
		t.Fatal("same args should produce same key")
	}
	// Different args → different key (almost certainly).
	k2 := g.Key("goodbye", 456)
	if k1 == k2 {
		t.Fatal("different args should produce different keys")
	}
	// Nil arg is handled.
	k3 := g.Key(nil)
	if k3 == "" {
		t.Fatal("nil key should not be empty")
	}
}

func TestStringJoinKeyGenerator(t *testing.T) {
	g := StringJoinKeyGenerator()
	k := g.Key("foo", 42)
	if k != ":foo:42" {
		t.Fatalf("expected :foo:42, got %s", k)
	}
}

func TestJSONKeyGenerator(t *testing.T) {
	g := JSONKeyGenerator()
	k := g.Key(map[string]int{"a": 1}, "hello")
	if k == "" {
		t.Fatal("key should not be empty")
	}
	// Stable: same input → same key.
	if k != g.Key(map[string]int{"a": 1}, "hello") {
		t.Fatal("same args should produce same key")
	}
}

func TestMethodKeyGenerator(t *testing.T) {
	g := NewMethodKeyGenerator("getUser", DefaultKeyGenerator())
	k1 := g.Key("user-1")
	if k1 == "" {
		t.Fatal("key should not be empty")
	}
	k2 := NewMethodKeyGenerator("getProduct", DefaultKeyGenerator()).Key("prod-1")
	if k1 == k2 {
		t.Fatal("different method names should produce different keys")
	}
}

// ---------------------------------------------------------------------------
// Eviction policy tests
// ---------------------------------------------------------------------------

func TestLRUEviction(t *testing.T) {
	c := NewCache(CacheConfig{MaxSize: 3, Eviction: EvictionLRU})
	c.Set("a", 1)
	c.Set("b", 2)
	c.Set("c", 3)

	// Access "a" to make it recently used.
	c.Get("a")
	c.Set("d", 4) // should evict "b" (LRU)

	_, ok := c.Get("b")
	if ok {
		t.Fatal("b should have been evicted")
	}
	_, ok = c.Get("a")
	if !ok {
		t.Fatal("a should still be present")
	}
}

func TestLFUEviction(t *testing.T) {
	c := NewCache(CacheConfig{MaxSize: 3, Eviction: EvictionLFU})
	c.Set("a", 1)
	c.Set("b", 2)
	c.Set("c", 3)

	// Access "a" twice so it has freq=3 (highest).
	c.Get("a")
	c.Get("a")
	c.Set("d", 4) // should evict one of {b,c,d} (freq=1), never "a"

	// "a" should never be evicted because it has the highest frequency.
	_, ok := c.Get("a")
	if !ok {
		t.Fatal("a should not be evicted (highest frequency)")
	}
	// Cache should contain exactly 3 entries after eviction.
	if c.Len() != 3 {
		t.Fatalf("expected 3 entries, got %d", c.Len())
	}
}

func TestFIFOEviction(t *testing.T) {
	c := NewCache(CacheConfig{MaxSize: 3, Eviction: EvictionFIFO})
	c.Set("a", 1)
	c.Set("b", 2)
	c.Set("c", 3)

	c.Set("d", 4) // should evict "a" (first in)

	_, ok := c.Get("a")
	if ok {
		t.Fatal("a should have been evicted (FIFO)")
	}
}

// ---------------------------------------------------------------------------
// TTLCache tests
// ---------------------------------------------------------------------------

func TestTTLCache_Expiry(t *testing.T) {
	c := NewTTLCache(CacheConfig{
		Name:     "ttl-test",
		TTL:      50 * time.Millisecond,
		MaxSize:  100,
		Eviction: EvictionTTL,
	})
	c.Set("k", "v")

	_, ok := c.Get("k")
	if !ok {
		t.Fatal("should be present immediately")
	}

	time.Sleep(60 * time.Millisecond)

	_, ok = c.Get("k")
	if ok {
		t.Fatal("should have expired")
	}
}

func TestTTLCache_Clear(t *testing.T) {
	c := NewTTLCache(CacheConfig{
		TTL:      time.Second,
		MaxSize:  100,
		Eviction: EvictionTTL,
	})
	c.Set("a", 1)
	c.Set("b", 2)
	c.Clear()
	if c.Len() != 0 {
		t.Fatal("cache should be empty after Clear")
	}
}

func TestTTLCache_SlidingRefresh(t *testing.T) {
	c := NewTTLCache(CacheConfig{
		TTL:      50 * time.Millisecond,
		MaxSize:  100,
		Eviction: EvictionTTL,
	})
	c.Set("k", "v")

	time.Sleep(40 * time.Millisecond)
	c.Get("k") // refresh TTL

	time.Sleep(40 * time.Millisecond) // 80ms total but TTL was refreshed
	_, ok := c.Get("k")
	if !ok {
		t.Fatal("should still be present after sliding refresh")
	}
}

// ---------------------------------------------------------------------------
// CacheConfig applyDefaults tests
// ---------------------------------------------------------------------------

func TestCacheConfig_ApplyDefaults(t *testing.T) {
	cfg := CacheConfig{}
	cfg2 := cfg.applyDefaults()
	if cfg2.MaxSize != DefaultMaxSize {
		t.Fatalf("expected MaxSize=%d, got %d", DefaultMaxSize, cfg2.MaxSize)
	}
	if cfg2.Eviction != DefaultEviction {
		t.Fatalf("expected Eviction=%s, got %s", DefaultEviction, cfg2.Eviction)
	}
	if cfg2.KeyGenerator == nil {
		t.Fatal("KeyGenerator should not be nil after applyDefaults")
	}
	// Negative TTL is zeroed.
	cfg3 := CacheConfig{TTL: -time.Second}.applyDefaults()
	if cfg3.TTL != 0 {
		t.Fatalf("expected TTL=0 for negative input, got %v", cfg3.TTL)
	}
	// Original is not mutated.
	if cfg.MaxSize != 0 {
		t.Fatal("original config should not be mutated")
	}
}

// ---------------------------------------------------------------------------
// CacheManager tests
// ---------------------------------------------------------------------------

func TestCacheManager_RegisterGetStats(t *testing.T) {
	logger := noOpLogger{}
	mgr := NewCacheManager(&logger)
	backend := &simpleMemoryBackend{c: NewLRUCache(100)}
	cfg := CacheConfig{
		Name:     "add",
		MaxSize:  10,
		Eviction: EvictionLRU,
	}
	mc := mgr.Register("add", add, cfg, backend)
	if mc == nil {
		t.Fatal("Register should return a MethodCache")
	}

	mc.Invoke(1, 2)
	mc.Invoke(1, 2)

	stats := mgr.Stats()
	if len(stats) != 1 {
		t.Fatalf("expected 1 stat entry, got %d", len(stats))
	}
	if stats["add"].Hits != 1 {
		t.Fatalf("expected 1 hit, got %d", stats["add"].Hits)
	}

	mc2 := mgr.Get("add")
	if mc2 == nil {
		t.Fatal("Get should find registered cache")
	}
}

func TestCacheManager_InvalidateAll(t *testing.T) {
	logger := noOpLogger{}
	mgr := NewCacheManager(&logger)
	backend1 := &simpleMemoryBackend{c: NewLRUCache(100)}
	backend2 := &simpleMemoryBackend{c: NewLRUCache(100)}
	cfg := CacheConfig{MaxSize: 10}
	mgr.Register("a", add, cfg, backend1)
	mgr.Register("b", multiply, cfg, backend2)

	mc := mgr.Get("a")
	mc.Invoke(1, 2)
	mc.Invoke(1, 2)

	mgr.InvalidateAll()
	stats := mgr.Stats()
	if stats["a"].Hits != 0 {
		t.Fatal("stats should be zero after InvalidateAll")
	}
}

func TestCacheManager_NoLogger(t *testing.T) {
	mgr := NewCacheManager(nil)
	if mgr == nil {
		t.Fatal("CacheManager should be created with nil logger")
	}
}

// ---------------------------------------------------------------------------
// Sentinel errors
// ---------------------------------------------------------------------------

func TestSentinelErrors(t *testing.T) {
	if ErrNotAFunction.Error() == "" {
		t.Fatal("ErrNotAFunction should have a message")
	}
	if ErrNoBackend.Error() == "" {
		t.Fatal("ErrNoBackend should have a message")
	}
}

// ---------------------------------------------------------------------------
// Helper tests
// ---------------------------------------------------------------------------

func TestBoxUnboxResult(t *testing.T) {
	// Single int result.
	rv := []reflect.Value{reflect.ValueOf(42)}
	boxed := boxResult(rv)
	unboxed := unboxResult(boxed)
	if len(unboxed) != 1 || unboxed[0].Int() != 42 {
		t.Fatalf("expected 42, got %v", unboxed)
	}

	// Two-value result (value + error).
	rv2 := []reflect.Value{reflect.ValueOf("ok"), reflect.Zero(reflect.TypeOf((*error)(nil)))}
	boxed2 := boxResult(rv2)
	unboxed2 := unboxResult(boxed2)
	if len(unboxed2) != 2 {
		t.Fatalf("expected 2 values, got %d", len(unboxed2))
	}

	// Empty result.
	rv3 := []reflect.Value{}
	boxed3 := boxResult(rv3)
	unboxed3 := unboxResult(boxed3)
	if len(unboxed3) != 0 {
		t.Fatalf("expected 0 values, got %d", len(unboxed3))
	}
}

func TestUnboxResult_PlainValue(t *testing.T) {
	// Simulates a plain value returned from Redis (not a *cachedResult).
	val := "hello"
	unboxed := unboxResult(val)
	if len(unboxed) != 1 || unboxed[0].String() != "hello" {
		t.Fatalf("expected 'hello', got %v", unboxed)
	}
}
