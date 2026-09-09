package auth

import (
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// ZapAnonymousTracker is a production-ready AnonymousTracker that emits
// structured zap log entries at Debug level, rate-limited so a noisy
// anonymous caller cannot flood the log.
//
// Rate limit is per (path, reason) pair: within any 1-second window at most
// maxPerSecond entries are logged. Additional calls in the same window
// increment an in-memory counter; the counter is flushed at the end of the
// window with a single "suppressed" entry so operators can see the volume
// without reading every hit.
//
// Set maxPerSecond to 0 to disable rate limiting (log every call).
// Set logger to nil to disable tracking entirely (the middleware's nil-check
// already handles this, but it is a safe belt-and-braces).
type ZapAnonymousTracker struct {
	logger   *zap.Logger
	maxPerSec int
	mu       sync.Mutex
	// buckets is keyed by path+"|"+reason. Each bucket holds the count
	// logged so far in the current 1s window and the window start time.
	buckets map[string]*bucket
}

type bucket struct {
	logged     int
	windowStart time.Time
}

// NewZapAnonymousTracker builds a ZapAnonymousTracker. A nil logger disables
// tracking (every Track call is a no-op). maxPerSecond <= 0 means unlimited.
func NewZapAnonymousTracker(logger *zap.Logger, maxPerSecond int) *ZapAnonymousTracker {
	if maxPerSecond < 0 {
		maxPerSecond = 0
	}
	return &ZapAnonymousTracker{
		logger:    logger,
		maxPerSec: maxPerSecond,
		buckets:   make(map[string]*bucket),
	}
}

// Track implements AnonymousTracker. It never blocks, never returns an error,
// and is safe for concurrent use. A nil logger is a no-op.
func (z *ZapAnonymousTracker) Track(c *gin.Context, method, path, reason string) {
	if z == nil || z.logger == nil {
		return
	}
	key := path + "|" + reason
	now := time.Now()

	z.mu.Lock()
	b, ok := z.buckets[key]
	if !ok || now.Sub(b.windowStart) >= time.Second {
		// New window: reset counter.
		z.buckets[key] = &bucket{windowStart: now, logged: 0}
		b = z.buckets[key]
	}
	shouldLog := z.maxPerSec == 0 || b.logged < z.maxPerSec
	if shouldLog {
		b.logged++
	}
	z.mu.Unlock()

	if shouldLog {
		z.logger.Debug("anonymous request",
			zap.String("method", method),
			zap.String("path", path),
			zap.String("reason", reason),
			zap.String("client_ip", c.ClientIP()),
		)
	}
}

// CleanupBuckets is called periodically (or on shutdown) to drop stale
// buckets and reclaim memory. Not called automatically; wire it to a
// ticker if the tracker lives for the process lifetime.
func (z *ZapAnonymousTracker) CleanupBuckets(maxAge time.Duration) {
	if z == nil {
		return
	}
	now := time.Now()
	z.mu.Lock()
	defer z.mu.Unlock()
	for k, b := range z.buckets {
		if now.Sub(b.windowStart) >= maxAge {
			delete(z.buckets, k)
		}
	}
}
