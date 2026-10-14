// Package middleware provides HTTP middleware for the Orion platform.
// The idempotency middleware ensures that retried POST requests with the
// same X-Idempotency-Key header return the cached response instead of
// creating duplicate resources.
package middleware

import (
	"bytes"
	"encoding/json"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// idempotencyEntry stores the cached response for a processed idempotent
// request.
type idempotencyEntry struct {
	statusCode int
	body       []byte
	headers    map[string]string
	expiresAt  time.Time
}

// IdempotencyCache is an in-memory cache for idempotent request responses.
// It is safe for concurrent use. Entries expire after the configured TTL.
type IdempotencyCache struct {
	mu      sync.RWMutex
	entries map[string]*idempotencyEntry
	ttl     time.Duration
}

// NewIdempotencyCache creates a new in-memory idempotency cache with the
// given TTL. A TTL of 0 means entries never expire (not recommended for
// production — use Redis instead).
func NewIdempotencyCache(ttl time.Duration) *IdempotencyCache {
	c := &IdempotencyCache{
		entries: make(map[string]*idempotencyEntry),
		ttl:     ttl,
	}
	go c.cleanup()
	return c
}

func (c *IdempotencyCache) get(key string) (*idempotencyEntry, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	e, ok := c.entries[key]
	if !ok {
		return nil, false
	}
	if c.ttl > 0 && time.Now().After(e.expiresAt) {
		return nil, false
	}
	return e, true
}

func (c *IdempotencyCache) set(key string, entry *idempotencyEntry) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.ttl > 0 {
		entry.expiresAt = time.Now().Add(c.ttl)
	}
	c.entries[key] = entry
}

func (c *IdempotencyCache) cleanup() {
	if c.ttl <= 0 {
		return
	}
	ticker := time.NewTicker(c.ttl)
	defer ticker.Stop()
	for range ticker.C {
		c.mu.Lock()
		now := time.Now()
		for k, e := range c.entries {
			if now.After(e.expiresAt) {
				delete(c.entries, k)
			}
		}
		c.mu.Unlock()
	}
}

// Idempotency returns middleware that caches responses for requests with
// an X-Idempotency-Key header. If the same key is seen again, the cached
// response is returned without executing the handler.
//
// The cache key is: tenant_id + method + path + idempotency_key.
// Only 2xx and 4xx responses are cached; 5xx errors are not cached so
// the client can retry.
func Idempotency(cache *IdempotencyCache) gin.HandlerFunc {
	return func(c *gin.Context) {
		key := c.GetHeader("X-Idempotency-Key")
		if key == "" {
			c.Next()
			return
		}

		tenantID := c.GetString("tenant_id")
		cacheKey := tenantID + ":" + c.Request.Method + ":" + c.Request.URL.Path + ":" + key

		// Check cache
		if entry, ok := cache.get(cacheKey); ok {
			// Return cached response
			for k, v := range entry.headers {
				c.Header(k, v)
			}
			c.Data(entry.statusCode, "application/json", entry.body)
			c.Abort()
			return
		}

		// Capture the response by wrapping the ResponseWriter
		writer := &captureWriter{ResponseWriter: c.Writer, body: &bytes.Buffer{}}
		c.Writer = writer

		c.Next()

		// Only cache successful (2xx) and client error (4xx) responses
		status := writer.Status()
		if status >= 200 && status < 500 {
			headers := make(map[string]string)
			for k, v := range writer.Header() {
				if len(v) > 0 {
					headers[k] = v[0]
				}
			}
			cache.set(cacheKey, &idempotencyEntry{
				statusCode: status,
				body:       writer.body.Bytes(),
				headers:    headers,
			})
		}
	}
}

// captureWriter wraps gin.ResponseWriter to capture the response body.
type captureWriter struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

func (w *captureWriter) Write(b []byte) (int, error) {
	w.body.Write(b)
	return w.ResponseWriter.Write(b)
}

// IsIdempotencyConflict checks if an error message indicates an
// idempotency conflict (e.g., duplicate key). This is a utility for
// services that perform their own idempotency checks at the DB level.
func IsIdempotencyConflict(body []byte) bool {
	var m map[string]any
	if err := json.Unmarshal(body, &m); err != nil {
		return false
	}
	if msg, ok := m["error"].(string); ok {
		return msg == "duplicate idempotency key"
	}
	return false
}
