package cache

import (
	"container/list"
	"sync"
)

// entry represents a single LRU cache entry.
type entry struct {
	key   string
	value interface{}
}

// LRUCache is a thread-safe LRU cache backed by container/list.
type LRUCache struct {
	store   *list.List
	items   map[string]*list.Element
	maxSize int
	mu      sync.RWMutex
}

// NewLRUCache creates a new LRU cache with the given capacity.
func NewLRUCache(maxSize int) *LRUCache {
	if maxSize <= 0 {
		maxSize = 100
	}
	return &LRUCache{
		store:   list.New(),
		items:   make(map[string]*list.Element, maxSize),
		maxSize: maxSize,
	}
}

// Get returns the value for the given key and whether it was found.
// Accessing a key moves it to the front (most recently used).
func (c *LRUCache) Get(key string) (interface{}, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if el, ok := c.items[key]; ok {
		c.store.MoveToFront(el)
		return el.Value.(*entry).value, true
	}
	return nil, false
}

// Set adds or updates a key-value pair in the cache.
// If the cache is full, the least recently used entry is evicted.
func (c *LRUCache) Set(key string, value interface{}) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Update existing key.
	if el, ok := c.items[key]; ok {
		c.store.MoveToFront(el)
		el.Value.(*entry).value = value
		return
	}

	// Evict if at capacity.
	if c.store.Len() >= c.maxSize {
		c.evictLocked()
	}

	el := c.store.PushFront(&entry{key: key, value: value})
	c.items[key] = el
}

// Delete removes the given key from the cache.
func (c *LRUCache) Delete(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if el, ok := c.items[key]; ok {
		delete(c.items, key)
		c.store.Remove(el)
	}
}

// Len returns the current number of entries in the cache.
func (c *LRUCache) Len() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.store.Len()
}

// Evict removes the least recently used entry.
func (c *LRUCache) Evict() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.evictLocked()
}

// evictLocked removes the least recently used entry (must hold mu).
func (c *LRUCache) evictLocked() {
	if el := c.store.Back(); el != nil {
		e := el.Value.(*entry)
		delete(c.items, e.key)
		c.store.Remove(el)
	}
}

// Clear removes all entries from the cache.
func (c *LRUCache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.store.Init()
	c.items = make(map[string]*list.Element, c.maxSize)
}
