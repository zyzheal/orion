package decorator

import (
	"container/list"
	"sync"
)

// LRUCache is a minimal thread-safe LRU cache used by the in-memory backend.
// It duplicates the implementation from internal/cache-mgmt/cache so that this
// package remains independently usable and testable without importing sibling
// packages. The two are kept intentionally in sync; if a bug is found in one,
// fix both.
type LRUCache struct {
	mu      sync.RWMutex
	store   *list.List            // ordered front (MRU) → back (LRU)
	idx     map[string]*list.Element
	maxSize int
}

// NewLRUCache creates an LRU cache with the given capacity.
func NewLRUCache(maxSize int) *LRUCache {
	if maxSize <= 0 {
		maxSize = 100
	}
	return &LRUCache{
		store:   list.New(),
		idx:     make(map[string]*list.Element, maxSize),
		maxSize: maxSize,
	}
}

// Get returns the value for the given key.
func (c *LRUCache) Get(key string) (interface{}, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if el, ok := c.idx[key]; ok {
		c.store.MoveToFront(el)
		return el.Value.(*cacheEntry).value, true
	}
	return nil, false
}

// Set adds or updates a key-value pair.
func (c *LRUCache) Set(key string, value interface{}) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if el, ok := c.idx[key]; ok {
		c.store.MoveToFront(el)
		el.Value.(*cacheEntry).value = value
		return
	}
	if c.store.Len() >= c.maxSize {
		c.evictLocked()
	}
	c.idx[key] = c.store.PushFront(&cacheEntry{key: key, value: value})
}

// Delete removes the given key.
func (c *LRUCache) Delete(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if el, ok := c.idx[key]; ok {
		delete(c.idx, key)
		c.store.Remove(el)
	}
}

// Len returns the number of entries.
func (c *LRUCache) Len() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.store.Len()
}

// Clear removes all entries.
func (c *LRUCache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.store.Init()
	c.idx = make(map[string]*list.Element, c.maxSize)
}

type cacheEntry struct {
	key   string
	value interface{}
}

// evictLocked removes the LRU entry. Caller must hold c.mu.
func (c *LRUCache) evictLocked() {
	if el := c.store.Back(); el != nil {
		en := el.Value.(*cacheEntry)
		delete(c.idx, en.key)
		c.store.Remove(el)
	}
}
