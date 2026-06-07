package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// PermissionCache provides Redis-backed caching for authorization decisions.
//
// Caching strategy:
//   - Key format: perm:{tenant}:{userId}:{resource}:{action}
//   - TTL: configurable (default 5 minutes)
//   - Only caches allow decisions (deny is never cached to avoid stale approvals)
//   - Invalidation by user, tenant, or global
//
// Performance target:
//   - Cache hit: < 1ms
//   - Hit rate: > 80% in read-heavy scenarios
type PermissionCache struct {
	client *redis.Client
	ttl    time.Duration
	stats  cacheStats
	mu     sync.RWMutex
}

// cacheStats tracks cache performance metrics.
type cacheStats struct {
	Hits           int64 `json:"hits"`
	Misses         int64 `json:"misses"`
	Sets           int64 `json:"sets"`
	Invalidations  int64 `json:"invalidations"`
}

// PermissionCacheStats is the public view of cache statistics.
type PermissionCacheStats struct {
	Hits           int64   `json:"hits"`
	Misses         int64   `json:"misses"`
	Sets           int64   `json:"sets"`
	Invalidations  int64   `json:"invalidations"`
	HitRate        float64 `json:"hit_rate"`
}

// PermissionCacheConfig holds configuration for PermissionCache.
type PermissionCacheConfig struct {
	// TTL is the cache entry lifetime. Default: 5 minutes.
	TTL time.Duration
}

// DefaultPermissionCacheConfig returns the default cache configuration.
func DefaultPermissionCacheConfig() PermissionCacheConfig {
	return PermissionCacheConfig{
		TTL: 5 * time.Minute,
	}
}

// NewPermissionCache creates a new Redis-backed permission cache.
func NewPermissionCache(client *redis.Client, cfg PermissionCacheConfig) *PermissionCache {
	if cfg.TTL <= 0 {
		cfg.TTL = 5 * time.Minute
	}
	return &PermissionCache{
		client: client,
		ttl:    cfg.TTL,
	}
}

// buildKey constructs the Redis key for a permission cache entry.
// Format: perm:{tenant}:{userId}:{resource}:{action}
func (c *PermissionCache) buildKey(req AuthZRequest) string {
	tenant := req.TenantID
	if tenant == "" {
		tenant = "default"
	}
	return fmt.Sprintf("perm:%s:%s:%s:%s", tenant, req.UserID, req.Resource, req.Action)
}

// cachedDecision is the JSON-serializable structure stored in Redis.
type cachedDecision struct {
	Allowed   bool      `json:"allowed"`
	Reason    string    `json:"reason"`
	Source    string    `json:"source"`
	CachedAt  time.Time `json:"cached_at"`
}

// Get retrieves a cached authorization decision.
// Returns nil if not cached or if the cached entry is a deny (deny entries are never stored).
func (c *PermissionCache) Get(ctx context.Context, req AuthZRequest) *AuthZDecision {
	if c.client == nil {
		return nil
	}

	key := c.buildKey(req)
	data, err := c.client.Get(ctx, key).Bytes()
	if err != nil {
		// Cache miss (key not found or Redis error)
		c.mu.Lock()
		c.stats.Misses++
		c.mu.Unlock()
		return nil
	}

	var entry cachedDecision
	if err := json.Unmarshal(data, &entry); err != nil {
		c.mu.Lock()
		c.stats.Misses++
		c.mu.Unlock()
		return nil
	}

	c.mu.Lock()
	c.stats.Hits++
	c.mu.Unlock()

	return &AuthZDecision{
		Allowed: entry.Allowed,
		Reason:  entry.Reason,
		Source:  entry.Source,
	}
}

// Set caches an authorization decision.
// Only allow decisions are cached; deny decisions are silently skipped.
func (c *PermissionCache) Set(ctx context.Context, req AuthZRequest, decision AuthZDecision) {
	if c.client == nil || !decision.Allowed {
		return
	}

	key := c.buildKey(req)
	entry := cachedDecision{
		Allowed:  decision.Allowed,
		Reason:   decision.Reason,
		Source:   decision.Source,
		CachedAt: time.Now(),
	}

	data, err := json.Marshal(entry)
	if err != nil {
		return
	}

	if err := c.client.Set(ctx, key, data, c.ttl).Err(); err == nil {
		c.mu.Lock()
		c.stats.Sets++
		c.mu.Unlock()
	}
}

// InvalidateUser removes all cached entries for a specific user in a tenant.
// Call this when a user's roles or permissions change.
func (c *PermissionCache) InvalidateUser(ctx context.Context, userID, tenantID string) {
	if c.client == nil {
		return
	}
	tenant := tenantID
	if tenant == "" {
		tenant = "*"
	}
	pattern := fmt.Sprintf("perm:%s:%s:*", tenant, userID)
	c.deletePattern(ctx, pattern)
}

// InvalidateTenant removes all cached entries for a tenant.
// Call this when tenant-wide policy changes occur.
func (c *PermissionCache) InvalidateTenant(ctx context.Context, tenantID string) {
	if c.client == nil {
		return
	}
	pattern := fmt.Sprintf("perm:%s:*", tenantID)
	c.deletePattern(ctx, pattern)
}

// InvalidateAll removes all permission cache entries.
// Call this for system-wide permission changes.
func (c *PermissionCache) InvalidateAll(ctx context.Context) {
	if c.client == nil {
		return
	}
	c.deletePattern(ctx, "perm:*")
}

// deletePattern deletes all keys matching a pattern using SCAN + DEL.
func (c *PermissionCache) deletePattern(ctx context.Context, pattern string) {
	var cursor uint64
	for {
		keys, nextCursor, err := c.client.Scan(ctx, cursor, pattern, 100).Result()
		if err != nil {
			break
		}
		if len(keys) > 0 {
			c.client.Del(ctx, keys...)
			c.mu.Lock()
			c.stats.Invalidations += int64(len(keys))
			c.mu.Unlock()
		}
		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}
}

// GetStats returns a snapshot of cache performance statistics.
func (c *PermissionCache) GetStats() PermissionCacheStats {
	c.mu.RLock()
	defer c.mu.RUnlock()

	total := c.stats.Hits + c.stats.Misses
	var hitRate float64
	if total > 0 {
		hitRate = float64(c.stats.Hits) / float64(total)
	}

	return PermissionCacheStats{
		Hits:          c.stats.Hits,
		Misses:        c.stats.Misses,
		Sets:          c.stats.Sets,
		Invalidations: c.stats.Invalidations,
		HitRate:       hitRate,
	}
}

// ResetStats resets all cache statistics to zero.
func (c *PermissionCache) ResetStats() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.stats = cacheStats{}
}
