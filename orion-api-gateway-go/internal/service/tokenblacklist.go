package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// TokenBlacklistChecker checks if a token has been revoked via Redis.
// It uses a local in-memory cache (30s TTL) to reduce Redis load.
// On Redis failure it fails open (allows the token) for availability.
type TokenBlacklistChecker struct {
	redisClient *redis.Client
	keyPrefix   string
	cache       *blacklistCache
}

type blacklistCacheEntry struct {
	revoked   bool
	checkedAt time.Time
}

type blacklistCache struct {
	mu      sync.RWMutex
	entries map[string]blacklistCacheEntry
	ttl     time.Duration
}

func newBlacklistCache(ttl time.Duration) *blacklistCache {
	c := &blacklistCache{
		entries: make(map[string]blacklistCacheEntry),
		ttl:     ttl,
	}
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			c.cleanup()
		}
	}()
	return c
}

func (c *blacklistCache) get(hash string) (bool, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	entry, ok := c.entries[hash]
	if !ok || time.Since(entry.checkedAt) > c.ttl {
		return false, false
	}
	return entry.revoked, true
}

func (c *blacklistCache) set(hash string, revoked bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries[hash] = blacklistCacheEntry{revoked: revoked, checkedAt: time.Now()}
}

func (c *blacklistCache) cleanup() {
	c.mu.Lock()
	defer c.mu.Unlock()
	now := time.Now()
	for k, v := range c.entries {
		if now.Sub(v.checkedAt) > c.ttl {
			delete(c.entries, k)
		}
	}
}

func (c *blacklistCache) clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries = make(map[string]blacklistCacheEntry)
}

// NewTokenBlacklistChecker creates a checker with default settings.
func NewTokenBlacklistChecker(rdb *redis.Client) *TokenBlacklistChecker {
	return &TokenBlacklistChecker{
		redisClient: rdb,
		keyPrefix:   "token:blacklist:",
		cache:       newBlacklistCache(30 * time.Second),
	}
}

// IsRevoked checks if a token has been revoked.
func (t *TokenBlacklistChecker) IsRevoked(ctx context.Context, token string) bool {
	tokenHash := hashTokenSHA256(token)

	if revoked, found := t.cache.get(tokenHash); found {
		return revoked
	}

	if t.redisClient == nil {
		return false
	}

	blocked, err := t.redisClient.Exists(ctx, t.keyPrefix+tokenHash).Result()
	revoked := err == nil && blocked > 0
	t.cache.set(tokenHash, revoked)
	return revoked
}

// ClearCache clears the local cache.
func (t *TokenBlacklistChecker) ClearCache() {
	t.cache.clear()
}

func hashTokenSHA256(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}
