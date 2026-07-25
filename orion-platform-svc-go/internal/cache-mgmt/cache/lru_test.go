package cache

import (
	"sync"
	"testing"
)

func TestLRUCache_SetAndGet(t *testing.T) {
	c := NewLRUCache(3)
	c.Set("a", 1)
	c.Set("b", 2)
	c.Set("c", 3)

	v, ok := c.Get("a")
	if !ok {
		t.Fatal("expected a to be present")
	}
	if v != 1 {
		t.Fatalf("got %v, want 1", v)
	}
}

func TestLRUCache_Miss(t *testing.T) {
	c := NewLRUCache(3)
	_, ok := c.Get("missing")
	if ok {
		t.Fatal("expected miss")
	}
}

func TestLRUCache_EvictionLRU(t *testing.T) {
	c := NewLRUCache(2)
	c.Set("a", 1)
	c.Set("b", 2)
	c.Set("c", 3) // should evict "a" (LRU)

	_, ok := c.Get("a")
	if ok {
		t.Fatal("a should have been evicted")
	}
	v, ok := c.Get("c")
	if !ok || v != 3 {
		t.Fatalf("c should be present, got ok=%v v=%v", ok, v)
	}
}

func TestLRUCache_Delete(t *testing.T) {
	c := NewLRUCache(3)
	c.Set("a", 1)
	c.Delete("a")
	_, ok := c.Get("a")
	if ok {
		t.Fatal("a should have been deleted")
	}
}

func TestLRUCache_UpdateExisting(t *testing.T) {
	c := NewLRUCache(3)
	c.Set("a", 1)
	c.Set("a", 2)
	v, ok := c.Get("a")
	if !ok || v != 2 {
		t.Fatalf("a should be 2, got ok=%v v=%v", ok, v)
	}
}

func TestLRUCache_Len(t *testing.T) {
	c := NewLRUCache(5)
	c.Set("a", 1)
	c.Set("b", 2)
	if c.Len() != 2 {
		t.Fatalf("len=%d, want 2", c.Len())
	}
}

func TestLRUCache_Clear(t *testing.T) {
	c := NewLRUCache(3)
	c.Set("a", 1)
	c.Set("b", 2)
	c.Clear()
	if c.Len() != 0 {
		t.Fatalf("len=%d after clear, want 0", c.Len())
	}
}

func TestLRUCache_DefaultSize(t *testing.T) {
	c := NewLRUCache(0)
	c.Set("a", 1)
	_, ok := c.Get("a")
	if !ok {
		t.Fatal("should accept default size")
	}
}

func TestLRUCache_ConcurrentAccess(t *testing.T) {
	c := NewLRUCache(100)
	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(2)
		go func(n int) {
			defer wg.Done()
			c.Set("key", n)
		}(i)
		go func() {
			defer wg.Done()
			c.Get("key")
		}()
	}
	wg.Wait()
}

func TestLRUCache_EvictExplicit(t *testing.T) {
	c := NewLRUCache(3)
	c.Set("a", 1)
	c.Set("b", 2)
	c.Evict() // should evict "a" (LRU)
	_, ok := c.Get("a")
	if ok {
		t.Fatal("a should have been evicted explicitly")
	}
}
