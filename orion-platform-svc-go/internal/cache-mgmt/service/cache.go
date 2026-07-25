package service

import (
	"context"
	"fmt"
	"hash/fnv"
	"sync"
	"time"

	"orion/platform-svc-go/internal/cache-mgmt/cache"
	"orion/platform-svc-go/internal/cache-mgmt/models"
	"orion/platform-svc-go/internal/cache-mgmt/repository"

	"go.uber.org/zap"
)

// Cache wraps a single method-level cache instance.
type Cache struct {
	name     string
	ttl      time.Duration
	maxSize  int
	eviction string
	store    *cache.LRUCache
	backend  string
}

// cacheStats tracks in-memory statistics for a cache.
type cacheStats struct {
	hits      int64
	misses    int64
	evictions int64
}

// MethodCacheManager manages multiple named method-level caches.
type MethodCacheManager struct {
	caches map[string]*Cache
	stats  map[string]*cacheStats
	logger *zap.Logger
	repo   *repository.Repository
	mu     sync.RWMutex
}

// CacheKey returns a deterministic cache key for a method call.
func (m *MethodCacheManager) CacheKey(configID string, method string, args ...interface{}) string {
	return fmt.Sprintf("%s:%s:%s", configID, method, hashArgs(args))
}

// Get returns a cached value for the given config and key.
// Updates in-memory hit/miss statistics.
func (m *MethodCacheManager) Get(configID string, key string) (interface{}, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	c, ok := m.caches[configID]
	s, statsOk := m.stats[configID]
	if !ok {
		return nil, false
	}
	v, found := c.store.Get(key)
	if found {
		if statsOk {
			s.hits++
		}
		return v, true
	}
	if statsOk {
		s.misses++
	}
	return nil, false
}

// Set stores a value in the cache for the given config and key.
func (m *MethodCacheManager) Set(configID string, key string, value interface{}) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	c, ok := m.caches[configID]
	if !ok {
		return fmt.Errorf("cache not found: %s", configID)
	}
	c.store.Set(key, value)
	return nil
}

// Delete removes a single value from the cache.
func (m *MethodCacheManager) Delete(configID string, key string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	c, ok := m.caches[configID]
	if !ok {
		return fmt.Errorf("cache not found: %s", configID)
	}
	c.store.Delete(key)
	return nil
}

// Invalidate clears all entries for a single config and removes its in-memory cache.
func (m *MethodCacheManager) Invalidate(configID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	c := m.caches[configID]
	if c == nil {
		return fmt.Errorf("cache not found: %s", configID)
	}
	c.store.Clear()
	delete(m.caches, configID)
	if s, ok := m.stats[configID]; ok {
		s.evictions += int64(c.store.Len())
		delete(m.stats, configID)
	}
	m.logger.Info("cache invalidated", zap.String("config_id", configID))
	return nil
}

// ClearAll clears every cache.
func (m *MethodCacheManager) ClearAll() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	for id, c := range m.caches {
		c.store.Clear()
		delete(m.caches, id)
	}
	for id := range m.stats {
		delete(m.stats, id)
	}
	m.logger.Info("all caches cleared")
	return nil
}

// Stats returns the in-memory statistics for a cache config.
func (m *MethodCacheManager) Stats(configID string) *models.CacheStats {
	m.mu.RLock()
	defer m.mu.RUnlock()

	s, ok := m.stats[configID]
	if !ok {
		return &models.CacheStats{ConfigID: configID}
	}
	return &models.CacheStats{
		ConfigID: configID,
		Hits:     s.hits,
		Misses:   s.misses,
		Evictions: s.evictions,
	}
}

// RebuildCache reads a config from the database and (re)builds the in-memory cache.
func (m *MethodCacheManager) RebuildCache(ctx context.Context, tenantID, configID string) (*Cache, error) {
	cfg, err := m.repo.GetConfigStatsForUpdate(ctx, tenantID, configID)
	if err != nil {
		return nil, err
	}
	if !cfg.Enabled {
		return nil, nil
	}

	maxSize := cfg.MaxSize
	if maxSize <= 0 {
		maxSize = 100
	}
	cacheInstance := &Cache{
		name:     cfg.Name,
		ttl:      time.Duration(cfg.TTL) * time.Second,
		maxSize:  maxSize,
		eviction: cfg.Eviction,
		store:    cache.NewLRUCache(maxSize),
		backend:  cfg.Backend,
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	m.caches[configID] = cacheInstance
	m.stats[configID] = &cacheStats{}
	return cacheInstance, nil
}

// NewMethodCacheManager creates a new manager with the given repository and logger.
func NewMethodCacheManager(repo *repository.Repository, logger *zap.Logger) *MethodCacheManager {
	return &MethodCacheManager{
		caches: make(map[string]*Cache),
		stats:  make(map[string]*cacheStats),
		repo:   repo,
		logger: logger,
	}
}

// hashArgs produces a short deterministic string from a variadic slice of arguments.
func hashArgs(args []interface{}) string {
	h := fnv.New32a()
	for _, a := range args {
		fmt.Fprintf(h, "%v", a)
	}
	return fmt.Sprintf("%x", h.Sum32())
}
