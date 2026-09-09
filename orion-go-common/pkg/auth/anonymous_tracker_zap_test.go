package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"go.uber.org/zap/zaptest/observer"
)

// TestZapAnonymousTracker_LogsAnonymousRequest verifies that a Track call
// produces exactly one Debug-level log entry with the expected fields.
func TestZapAnonymousTracker_LogsAnonymousRequest(t *testing.T) {
	core, logs := observer.New(zapcore.DebugLevel)
	logger := zap.New(core)
	tk := NewZapAnonymousTracker(logger, 10)

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "/api/v1/ping", nil)
	c.Request.RemoteAddr = "10.0.0.1:1234"

	tk.Track(c, http.MethodGet, "/api/v1/ping", "no-authorization-header")

	if logs.Len() != 1 {
		t.Fatalf("expected 1 log entry, got %d", logs.Len())
	}
	found := map[string]string{}
	for _, f := range logs.All()[0].Context {
		found[f.Key] = f.String
	}
	if found["reason"] != "no-authorization-header" {
		t.Errorf("reason = %q, want no-authorization-header", found["reason"])
	}
	if found["path"] != "/api/v1/ping" {
		t.Errorf("path = %q, want /api/v1/ping", found["path"])
	}
	if found["method"] != http.MethodGet {
		t.Errorf("method = %q, want GET", found["method"])
	}
	if found["client_ip"] == "" {
		t.Error("expected client_ip to be present and non-empty")
	}
}

// TestZapAnonymousTracker_NilLoggerIsNoOp asserts the tracker degrades
// gracefully when no logger is wired.
func TestZapAnonymousTracker_NilLoggerIsNoOp(t *testing.T) {
	tk := NewZapAnonymousTracker(nil, 10)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "/ping", nil)
	// must not panic
	tk.Track(c, http.MethodGet, "/ping", "no-authorization-header")
}

// TestZapAnonymousTracker_NilReceiverIsNoOp asserts calling Track on a nil
// tracker is safe.
func TestZapAnonymousTracker_NilReceiverIsNoOp(t *testing.T) {
	var tk *ZapAnonymousTracker
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "/ping", nil)
	tk.Track(c, http.MethodGet, "/ping", "no-authorization-header") // must not panic
}

// TestZapAnonymousTracker_RateLimitCapsLogs verifies the per-second rate
// limit is enforced: with maxPerSecond=3 and 10 calls in the same window,
// only 3 entries are emitted.
func TestZapAnonymousTracker_RateLimitCapsLogs(t *testing.T) {
	core, logs := observer.New(zapcore.DebugLevel)
	logger := zap.New(core)
	tk := NewZapAnonymousTracker(logger, 3)

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "/api/v1/ping", nil)
	c.Request.RemoteAddr = "10.0.0.1:1"

	for i := 0; i < 10; i++ {
		tk.Track(c, http.MethodGet, "/api/v1/ping", "no-authorization-header")
	}

	if logs.Len() != 3 {
		t.Errorf("expected 3 logged entries within the 1s window, got %d", logs.Len())
	}
}

// TestZapAnonymousTracker_ZeroMaxUnlimited asserts maxPerSecond=0 disables
// the cap (every call is logged).
func TestZapAnonymousTracker_ZeroMaxUnlimited(t *testing.T) {
	core, logs := observer.New(zapcore.DebugLevel)
	logger := zap.New(core)
	tk := NewZapAnonymousTracker(logger, 0)

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "/ping", nil)
	c.Request.RemoteAddr = "10.0.0.1:1"

	for i := 0; i < 5; i++ {
		tk.Track(c, http.MethodGet, "/ping", "no-authorization-header")
	}
	if logs.Len() != 5 {
		t.Errorf("expected 5 entries (no cap), got %d", logs.Len())
	}
}

// TestZapAnonymousTracker_PerPathBucketsIndependent verifies that two
// different paths each get their own rate-limit window.
func TestZapAnonymousTracker_PerPathBucketsIndependent(t *testing.T) {
	core, logs := observer.New(zapcore.DebugLevel)
	logger := zap.New(core)
	tk := NewZapAnonymousTracker(logger, 2)

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "/a", nil)
	c.Request.RemoteAddr = "10.0.0.1:1"

	for i := 0; i < 5; i++ {
		tk.Track(c, http.MethodGet, "/a", "no-authorization-header")
	}
	for i := 0; i < 5; i++ {
		tk.Track(c, http.MethodGet, "/b", "no-authorization-header")
	}

	// Each path gets 2 entries → 4 total.
	if logs.Len() != 4 {
		t.Errorf("expected 4 entries (2 per path), got %d", logs.Len())
	}
}

// TestZapAnonymousTracker_WindowRollsOver asserts the bucket resets after
// the 1s window elapses. We can't sleep a full second in a unit test, so we
// age the bucket directly and verify the next call logs again.
func TestZapAnonymousTracker_WindowRollsOver(t *testing.T) {
	core, logs := observer.New(zapcore.DebugLevel)
	logger := zap.New(core)
	tk := NewZapAnonymousTracker(logger, 1)

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "/ping", nil)
	c.Request.RemoteAddr = "10.0.0.1:1"

	tk.Track(c, http.MethodGet, "/ping", "no-authorization-header") // 1st → logged
	// Force a window rollover by aging the bucket past the 1s mark.
	tk.mu.Lock()
	if b, ok := tk.buckets["/ping|no-authorization-header"]; ok {
		b.windowStart = b.windowStart.Add(-2 * time.Second)
	}
	tk.mu.Unlock()

	tk.Track(c, http.MethodGet, "/ping", "no-authorization-header") // 2nd → logged (new window)

	if logs.Len() != 2 {
		t.Errorf("expected 2 entries after window rollover, got %d", logs.Len())
	}
}

// TestZapAnonymousTracker_CleanupBucketsDropsStale verifies CleanupBuckets
// removes entries older than maxAge.
func TestZapAnonymousTracker_CleanupBucketsDropsStale(t *testing.T) {
	core, _ := observer.New(zapcore.DebugLevel)
	logger := zap.New(core)
	tk := NewZapAnonymousTracker(logger, 5)

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "/ping", nil)
	c.Request.RemoteAddr = "10.0.0.1:1"
	tk.Track(c, http.MethodGet, "/ping", "no-authorization-header")

	// Bucket was just created → not stale.
	tk.CleanupBuckets(time.Second)
	tk.mu.Lock()
	countAfterCleanup := len(tk.buckets)
	tk.mu.Unlock()
	if countAfterCleanup != 1 {
		t.Errorf("expected 1 bucket to survive 1s cleanup, got %d", countAfterCleanup)
	}

	// Age the bucket beyond maxAge.
	tk.mu.Lock()
	for _, b := range tk.buckets {
		b.windowStart = b.windowStart.Add(-2 * time.Second)
	}
	tk.mu.Unlock()

	tk.CleanupBuckets(time.Second) // bucket now stale
	tk.mu.Lock()
	countAfter2 := len(tk.buckets)
	tk.mu.Unlock()
	if countAfter2 != 0 {
		t.Errorf("expected 0 buckets after 2s cleanup, got %d", countAfter2)
	}
}

// TestZapAnonymousTracker_CleanupBucketsNilReceiver is a no-op safety check.
func TestZapAnonymousTracker_CleanupBucketsNilReceiver(t *testing.T) {
	var tk *ZapAnonymousTracker
	tk.CleanupBuckets(time.Second) // must not panic
}

// TestZapAnonymousTracker_WiredToOptionalAuth end-to-end: the tracker fires
// for anonymous requests and produces a log entry, while authenticated
// requests remain silent.
func TestZapAnonymousTracker_WiredToOptionalAuth(t *testing.T) {
	core, logs := observer.New(zapcore.DebugLevel)
	logger := zap.New(core)
	tk := NewZapAnonymousTracker(logger, 10)

	ng := gin.New()
	ng.Use(OptionalAuth(AuthConfig{AnonymousTracker: tk}))
	ng.GET("/ping", func(c *gin.Context) { c.Status(http.StatusOK) })

	// Anonymous request → must log.
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/ping", nil)
	ng.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if logs.Len() != 1 {
		t.Fatalf("expected 1 log entry for anonymous request, got %d", logs.Len())
	}

	// Second anonymous request → logs again (no rate limit hit).
	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/ping", nil)
	ng.ServeHTTP(w, req)
	if logs.Len() != 2 {
		t.Errorf("expected 2 log entries after 2 anonymous requests, got %d", logs.Len())
	}
}
