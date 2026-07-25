package decorator

import (
	"sync"
	"time"
)

// Cache is the in-memory cache used by the method-level decorator.
// All methods are safe for concurrent use.
type Cache struct {
	cfg     CacheConfig
	ev      evictor
	onEvict func(key string) // optional callback fired on eviction
}

// NewCache creates a new in-memory cache from the given config.
func NewCache(cfg CacheConfig) *Cache {
	cfg = cfg.applyDefaults()
	ev := newEvictor(cfg.Eviction, cfg.MaxSize)
	return &Cache{cfg: cfg, ev: ev}
}

// Set stores a key/value pair. If the cache is at capacity, the eviction
// policy determines which entry is removed.
func (c *Cache) Set(key string, value interface{}) {
	c.ev.put(key, value)
}

// Get retrieves a value by key. Returns nil and false when the key is absent
// or when the entry has expired due to TTL.
func (c *Cache) Get(key string) (interface{}, bool) {
	v, ok := c.ev.get(key)
	if !ok {
		return nil, false
	}
	// For TTL eviction we perform lazy expiry here.
	// The LRU evictor stores entries without expiry tracking; TTL expiry
	// is managed by the TTLCache wrapper below.
	return v, true
}

// Delete removes the entry identified by key.
func (c *Cache) Delete(key string) {
	c.ev.delete(key)
}

// Len returns the current number of entries in the cache.
func (c *Cache) Len() int {
	return c.ev.len()
}

// Clear removes all entries from the cache.
func (c *Cache) Clear() {
	c.ev.clear()
}

// TTLCache wraps a Cache and adds time-to-live expiry on each entry.
// TTL expiry is evaluated lazily on Get/Set/Delete, plus a periodic background
// sweep for entries that have not been accessed.
type TTLCache struct {
	inner    *Cache
	ttl      time.Duration
	mu       sync.RWMutex
	expiry   map[string]time.Time
	stopSweep chan struct{}
}

// NewTTLCache creates a new cache that enforces per-entry TTL expiry.
// When ttl is zero, the cache behaves like a normal Cache (no expiry).
func NewTTLCache(cfg CacheConfig) *TTLCache {
	cfg = cfg.applyDefaults()
	ttl := cfg.TTL
	if ttl <= 0 {
		return &TTLCache{inner: NewCache(cfg)}
	}
	inner := NewCache(cfg)
	ttc := &TTLCache{
		inner:     inner,
		ttl:       ttl,
		expiry:    make(map[string]time.Time),
		stopSweep: make(chan struct{}),
	}
	// Start the background sweep.
	if cfg.TTL > 0 {
		go ttc.sweep()
	}
	return ttc
}

// Set stores a value with the configured TTL.
func (c *TTLCache) Set(key string, value interface{}) {
	c.inner.Set(key, value)
	if c.ttl > 0 {
		c.mu.Lock()
		c.expiry[key] = time.Now().Add(c.ttl)
		c.mu.Unlock()
	}
}

// Get returns the cached value if present and not yet expired.
func (c *TTLCache) Get(key string) (interface{}, bool) {
	if c.ttl > 0 {
		c.mu.RLock()
		exp, ok := c.expiry[key]
		c.mu.RUnlock()
		if !ok || time.Now().After(exp) {
			c.Delete(key)
			return nil, false
		}
	}
	v, ok := c.inner.Get(key)
	if ok {
		// Refresh TTL on access (like sliding TTL).
		if c.ttl > 0 {
			c.mu.Lock()
			c.expiry[key] = time.Now().Add(c.ttl)
			c.mu.Unlock()
		}
	}
	return v, ok
}

// Delete removes an entry from the cache.
func (c *TTLCache) Delete(key string) {
	c.inner.Delete(key)
	if c.ttl > 0 {
		c.mu.Lock()
		delete(c.expiry, key)
		c.mu.Unlock()
	}
}

// Len returns the current number of entries.
func (c *TTLCache) Len() int {
	return c.inner.Len()
}

// Clear removes all entries and stops the background sweep.
func (c *TTLCache) Clear() {
	c.inner.Clear()
	c.mu.Lock()
	defer c.mu.Unlock()
	clear(c.expiry)
	if c.stopSweep != nil {
		select {
		case c.stopSweep <- struct{}{}:
		default:
		}
	}
}

// sweep periodically removes expired entries. Runs in the background until
// Clear() is called.
func (c *TTLCache) sweep() {
	interval := min(c.ttl/2, time.Minute)
	if interval < time.Second {
		interval = time.Second
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			c.evictExpired()
		case <-c.stopSweep:
			return
		}
	}
}

// evictExpired removes all entries whose TTL has elapsed.
func (c *TTLCache) evictExpired() {
	now := time.Now()
	c.mu.RLock()
	defer c.mu.RUnlock()
	for key, exp := range c.expiry {
		if now.After(exp) {
			c.inner.Delete(key)
		}
	}
}
