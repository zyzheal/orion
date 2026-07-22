// Package middleware provides Orion-platform-specific Gin middleware.
package middleware

import (
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// RateLimitConfig holds configuration for the token-bucket rate limiter.
type RateLimitConfig struct {
	// RequestsPerMin is the default max requests per minute per client.
	// Default: 100 req/min.
	RequestsPerMin int
	// Burst allows short spikes up to this many requests before being
	// rate-limited. Default equals RequestsPerMin (burst == capacity).
	Burst int
	// EndpointLimits maps path-prefix patterns to per-endpoint limits.
	// First matching prefix wins. Path is matched via pathPrefixMatch.
	EndpointLimits map[string]*EndpointLimit
}

// EndpointLimit holds per-endpoint rate limit configuration.
type EndpointLimit struct {
	RequestsPerMin int
	Burst          int
}

// DefaultRateLimitConfig returns production-safe defaults:
// 100 req/min per client with burst 100, and tighter limits on auth
// endpoints (20 req/min, burst 10) to mitigate brute-force attacks.
func DefaultRateLimitConfig() RateLimitConfig {
	return RateLimitConfig{
		RequestsPerMin: 100,
		Burst:          100,
		EndpointLimits: map[string]*EndpointLimit{
			"/api/v1/auth/login":    {RequestsPerMin: 20, Burst: 10},
			"/api/v1/auth/register": {RequestsPerMin: 10, Burst: 5},
			"/api/v1/auth/password": {RequestsPerMin: 10, Burst: 5},
			"/api/v1/auth/token":    {RequestsPerMin: 30, Burst: 15},
			"/api/v1/auth/verify":   {RequestsPerMin: 30, Burst: 15},
		},
	}
}

// ---------------------------------------------------------------------------
// Token bucket
// ---------------------------------------------------------------------------

// tokenBucket implements a thread-safe token bucket algorithm.
type tokenBucket struct {
	mu       sync.Mutex
	tokens   float64
	capacity float64
	refillAt time.Time
	// refillInterval is the period at which tokens are replenished.
	// refillTokens is the number of tokens added each interval.
	refillInterval time.Duration
	refillTokens   float64
}

// newTokenBucket creates a bucket that allows up to `rate` tokens per
// refillInterval with an initial capacity of `burst`.
func newTokenBucket(rate float64, refillInterval time.Duration, burst int) *tokenBucket {
	return &tokenBucket{
		tokens:         float64(burst),
		capacity:       float64(burst),
		refillAt:       time.Now(),
		refillInterval: refillInterval,
		refillTokens:   rate,
	}
}

// allow checks whether a single token is available.
// If yes, consumes the token and returns (true, 0).
// If not, returns (false, retryAfter) where retryAfter is the time until
// at least one token is available again.
func (b *tokenBucket) allow() (bool, time.Duration) {
	b.mu.Lock()
	defer b.mu.Unlock()

	now := time.Now()
	if now.After(b.refillAt) {
		// Compute how many full refill intervals have elapsed.
		elapsed := now.Sub(b.refillAt)
		intervals := float64(elapsed) / float64(b.refillInterval)
		if intervals > 0 {
			b.tokens += intervals * b.refillTokens
			if b.tokens > b.capacity {
				b.tokens = b.capacity
			}
			// Advance refillAt by full intervals only (avoid drift).
			b.refillAt = b.refillAt.Add(time.Duration(intervals) * b.refillInterval)
		}
	}

	if b.tokens >= 1.0 {
		b.tokens--
		return true, 0
	}

	// Not enough tokens: compute time until next token arrives.
	nextTokenIn := b.refillAt.Sub(now)
	if nextTokenIn < 0 {
		nextTokenIn = 0
	}
	return false, nextTokenIn
}

// ---------------------------------------------------------------------------
// Store: per-client buckets
// ---------------------------------------------------------------------------

// bucketStore holds per-client token buckets. It is safe for concurrent use
// and periodically prunes stale entries.
type bucketStore struct {
	mu       sync.RWMutex
	buckets  map[string]*tokenBucket
	interval time.Duration
	capacity int
}

func newBucketStore(interval time.Duration, capacity int) *bucketStore {
	bs := &bucketStore{
		buckets:  make(map[string]*tokenBucket),
		interval: interval,
		capacity: capacity,
	}
	go bs.pruneLoop()
	return bs
}

func (bs *bucketStore) get(key string, rate float64, refillInterval time.Duration) *tokenBucket {
	bs.mu.Lock()
	defer bs.mu.Unlock()
	tb, ok := bs.buckets[key]
	if !ok {
		tb = newTokenBucket(rate, refillInterval, bs.capacity)
		bs.buckets[key] = tb
	}
	return tb
}

func (bs *bucketStore) pruneLoop() {
	ticker := time.NewTicker(bs.interval)
	defer ticker.Stop()
	for range ticker.C {
		bs.mu.Lock()
		for k, tb := range bs.buckets {
			tb.mu.Lock()
			now := time.Now()
			// Prune bucket if no refill has happened in 2 * refillInterval.
			// This means the client has been idle for a while.
			if now.Sub(tb.refillAt) > 2*tb.refillInterval {
				delete(bs.buckets, k)
			}
			tb.mu.Unlock()
		}
		bs.mu.Unlock()
	}
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

// RateLimitStore holds per-config bucket stores for multi-tenant rate limiting.
type RateLimitStore struct {
	mu      sync.RWMutex
	store   map[string]*bucketStore
	configs map[string]*RateLimitConfig
}

func NewRateLimitStore() *RateLimitStore {
	return &RateLimitStore{
		// Ensure "default" entry exists so GetBucket never returns nil.
		store:   map[string]*bucketStore{"default": newBucketStore(5*time.Minute, 100)},
		configs: map[string]*RateLimitConfig{"default": {RequestsPerMin: 100, Burst: 100}},
	}
}

// RegisterConfig registers a rate-limit config under the given key.
// When not found, the middleware falls back to the "default" key.
func (s *RateLimitStore) RegisterConfig(key string, cfg *RateLimitConfig) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.configs[key] = cfg
	s.store[key] = newBucketStore(5*time.Minute, cfg.Burst)
}

// GetBucket returns the bucketStore and config for the given key.
// Falls back to "default" if not found.
func (s *RateLimitStore) GetBucket(key string) (*bucketStore, *RateLimitConfig) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	store := s.store["default"]
	cfg := s.configs["default"]
	if s, ok := s.store[key]; ok {
		store = s
	}
	if c, ok := s.configs[key]; ok {
		cfg = c
	}
	return store, cfg
}

// clientKey extracts a rate-limit client key from the request.
// Priority: X-Client-IP header -> X-Forwarded-For -> Gin ClientIP.
func clientKey(c *gin.Context) string {
	if ip := c.GetHeader("X-Client-IP"); ip != "" {
		return ip
	}
	if ip := c.GetHeader("X-Forwarded-For"); ip != "" {
		return ip
	}
	return c.ClientIP()
}

// pathPrefixMatch returns true if p is exactly path or starts with path + "/".
func pathPrefixMatch(p, prefix string) bool {
	return p == prefix || (len(p) > len(prefix) && p[:len(prefix)] == prefix && p[len(prefix)] == '/')
}

// endpointConfig resolves per-endpoint config: finds first matching prefix
// in EndpointLimits (longest prefix wins), or returns nil (use default).
func endpointConfig(path string, limits map[string]*EndpointLimit) *EndpointLimit {
	if len(limits) == 0 {
		return nil
	}
	// Longest prefix match wins.
	best := ""
	for pfx := range limits {
		if pathPrefixMatch(path, pfx) && len(pfx) > len(best) {
			best = pfx
		}
	}
	if best == "" {
		return nil
	}
	return limits[best]
}

// RateLimit returns a Gin middleware that enforces per-client rate limits
// using a token-bucket algorithm. When a client exceeds its limit, the
// middleware returns 429 Too Many Requests with a `Retry-After` header.
func RateLimit(cfg RateLimitConfig) gin.HandlerFunc {
	store := newBucketStore(5*time.Minute, cfg.Burst)

	// Refill tokens each 1-second interval for smooth rate limiting.
	refillInterval := 1 * time.Second

	return func(c *gin.Context) {
		// Resolve per-endpoint config if present.
		ep := endpointConfig(c.Request.URL.Path, cfg.EndpointLimits)
		var rate float64
		if ep != nil {
			rate = float64(ep.RequestsPerMin) / 60.0
		} else {
			rate = float64(cfg.RequestsPerMin) / 60.0
		}

		ck := clientKey(c)
		tb := store.get(ck, rate, refillInterval)

		allowed, retryAfter := tb.allow()
		if !allowed {
			// Round up retryAfter to at least 1 second for readability.
			retrySec := int(retryAfter.Seconds())
			if retrySec < 1 {
				retrySec = 1
			}
			c.Header("Retry-After", strconv.Itoa(retrySec))
			c.Header("X-RateLimit-Limit", strconv.Itoa(int(rate*60)))
			c.Header("X-RateLimit-Remaining", "0")
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": gin.H{
					"code":    http.StatusTooManyRequests,
					"type":    "TooManyRequests",
					"message": "rate limit exceeded, please try again later",
				},
			})
			return
		}

		// Response headers: indicate remaining budget (approximate).
		tb.mu.Lock()
		remaining := int(tb.tokens)
		tb.mu.Unlock()
		c.Header("X-RateLimit-Limit", strconv.Itoa(int(rate*60)))
		c.Header("X-RateLimit-Remaining", strconv.Itoa(remaining))

		c.Next()
	}
}

// RateLimitGroup returns a Gin middleware that selects rate-limit
// configuration per tenant/client key. The key is read from the
// X-Tenant-ID header; falls back to "default" if missing.
func RateLimitGroup(s *RateLimitStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID := c.GetHeader("X-Tenant-ID")
		if tenantID == "" {
			tenantID = "default"
		}

		store, cfg := s.GetBucket(tenantID)
		if store == nil {
			// No config registered; skip silently.
			c.Next()
			return
		}

		// Resolve per-endpoint config.
		ep := endpointConfig(c.Request.URL.Path, cfg.EndpointLimits)
		var rate float64
		if ep != nil {
			rate = float64(ep.RequestsPerMin) / 60.0
		} else {
			rate = float64(cfg.RequestsPerMin) / 60.0
		}

		ck := clientKey(c)
		tb := store.get(ck, rate, time.Second)

		allowed, retryAfter := tb.allow()
		if !allowed {
			retrySec := int(retryAfter.Seconds())
			if retrySec < 1 {
				retrySec = 1
			}
			c.Header("Retry-After", strconv.Itoa(retrySec))
			c.Header("X-RateLimit-Limit", strconv.Itoa(int(rate*60)))
			c.Header("X-RateLimit-Remaining", "0")
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": gin.H{
					"code":    http.StatusTooManyRequests,
					"type":    "TooManyRequests",
					"message": "rate limit exceeded, please try again later",
				},
			})
			return
		}

		tb.mu.Lock()
		remaining := int(tb.tokens)
		tb.mu.Unlock()
		c.Header("X-RateLimit-Limit", strconv.Itoa(int(rate*60)))
		c.Header("X-RateLimit-Remaining", strconv.Itoa(remaining))

		c.Next()
	}
}
