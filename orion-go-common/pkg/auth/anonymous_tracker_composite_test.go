package auth

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"go.uber.org/zap/zaptest/observer"
)

// fanOutTracker is a test double that records every Track call for
// fan-out assertions. It implements AnonymousTracker directly.
type fanOutTracker struct {
	mu     sync.Mutex
	calls  []fanOutCall
}

type fanOutCall struct {
	method, path, reason string
}

func (r *fanOutTracker) Track(c *gin.Context, method, path, reason string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.calls = append(r.calls, fanOutCall{method, path, reason})
}

func (r *fanOutTracker) callsCopy() []fanOutCall {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]fanOutCall, len(r.calls))
	copy(out, r.calls)
	return out
}

// TestComposite_FansOutToAllTrackers verifies Track is forwarded to every
// underlying tracker.
func TestComposite_FansOutToAllTrackers(t *testing.T) {
	core, logs := observer.New(zapcore.DebugLevel)
	zapTk := NewZapAnonymousTracker(zap.New(core), 10)
	promTk := NewPrometheusAnonymousTracker(prometheus.NewRegistry())
	rec := &fanOutTracker{}
	c := NewCompositeAnonymousTracker(zapTk, promTk, rec)

	gc, _ := gin.CreateTestContext(httptest.NewRecorder())
	gc.Request = httptest.NewRequest(http.MethodGet, "/api/v1/ping", nil)
	gc.Request.RemoteAddr = "10.0.0.1:1"

	c.Track(gc, http.MethodGet, "/api/v1/ping", "no-authorization-header")

	if logs.Len() != 1 {
		t.Errorf("zap tracker: expected 1 log, got %d", logs.Len())
	}
	if got := testutil.ToFloat64(promTk.Counter().WithLabelValues(http.MethodGet, "/api/v1/ping", "no-authorization-header")); got != 1 {
		t.Errorf("prom tracker: expected 1, got %v", got)
	}
	if got := len(rec.callsCopy()); got != 1 {
		t.Errorf("recording tracker: expected 1 call, got %d", got)
	}
}

// TestComposite_FiltersNilTrackers verifies nil trackers are dropped from the
// fan-out without panicking.
func TestComposite_FiltersNilTrackers(t *testing.T) {
	rec := &fanOutTracker{}
	c := NewCompositeAnonymousTracker(nil, nil, rec, nil)

	gc, _ := gin.CreateTestContext(httptest.NewRecorder())
	gc.Request = httptest.NewRequest(http.MethodGet, "/ping", nil)
	c.Track(gc, http.MethodGet, "/ping", "no-authorization-header") // must not panic

	if got := len(rec.callsCopy()); got != 1 {
		t.Errorf("expected 1 call to the non-nil tracker, got %d", got)
	}
}

// TestComposite_AllNilIsNoOp asserts an all-nil composite is a no-op.
func TestComposite_AllNilIsNoOp(t *testing.T) {
	c := NewCompositeAnonymousTracker(nil, nil, nil)
	gc, _ := gin.CreateTestContext(httptest.NewRecorder())
	gc.Request = httptest.NewRequest(http.MethodGet, "/ping", nil)
	c.Track(gc, http.MethodGet, "/ping", "no-authorization-header") // must not panic
}

// TestComposite_EmptyConstructorIsNoOp asserts the empty composite is a
// no-op.
func TestComposite_EmptyConstructorIsNoOp(t *testing.T) {
	c := NewCompositeAnonymousTracker()
	gc, _ := gin.CreateTestContext(httptest.NewRecorder())
	gc.Request = httptest.NewRequest(http.MethodGet, "/ping", nil)
	c.Track(gc, http.MethodGet, "/ping", "no-authorization-header") // must not panic
}

// TestComposite_NilReceiverIsNoOp asserts calling Track on a nil composite is
// safe.
func TestComposite_NilReceiverIsNoOp(t *testing.T) {
	var c *CompositeAnonymousTracker
	gc, _ := gin.CreateTestContext(httptest.NewRecorder())
	gc.Request = httptest.NewRequest(http.MethodGet, "/ping", nil)
	c.Track(gc, http.MethodGet, "/ping", "no-authorization-header") // must not panic
}

// TestComposite_PreservesOrder verifies trackers are called in registration
// order.
func TestComposite_PreservesOrder(t *testing.T) {
	a := &fanOutTracker{}
	b := &fanOutTracker{}
	c := &fanOutTracker{}
	composite := NewCompositeAnonymousTracker(a, b, c)

	gc, _ := gin.CreateTestContext(httptest.NewRecorder())
	gc.Request = httptest.NewRequest(http.MethodGet, "/ping", nil)
	composite.Track(gc, http.MethodGet, "/ping", "no-authorization-header")

	if len(a.callsCopy()) != 1 || len(b.callsCopy()) != 1 || len(c.callsCopy()) != 1 {
		t.Fatalf("expected 1 call each, got a=%d b=%d c=%d",
			len(a.callsCopy()), len(b.callsCopy()), len(c.callsCopy()))
	}
}

// TestComposite_WiredToOptionalAuth end-to-end: the composite fires both the
// zap logger and the Prometheus counter for anonymous requests, and stays
// silent for authenticated requests.
func TestComposite_WiredToOptionalAuth(t *testing.T) {
	core, logs := observer.New(zapcore.DebugLevel)
	zapTk := NewZapAnonymousTracker(zap.New(core), 10)
	promTk := NewPrometheusAnonymousTracker(prometheus.NewRegistry())
	composite := NewCompositeAnonymousTracker(zapTk, promTk)

	ng := gin.New()
	ng.Use(OptionalAuth(AuthConfig{AnonymousTracker: composite}))
	ng.GET("/ping", func(c *gin.Context) { c.Status(http.StatusOK) })

	w := httptest.NewRecorder()
	ng.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/ping", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if logs.Len() != 1 {
		t.Errorf("expected 1 zap log entry for anonymous request, got %d", logs.Len())
	}
	if got := testutil.ToFloat64(promTk.Counter().WithLabelValues(http.MethodGet, "/ping", "no-authorization-header")); got != 1 {
		t.Errorf("expected prom counter=1, got %v", got)
	}
}

// TestComposite_RateLimitAppliesPerTracker verifies the zap tracker's rate
// limit is independent of the Prometheus counter's unbounded counting.
func TestComposite_RateLimitAppliesPerTracker(t *testing.T) {
	core, logs := observer.New(zapcore.DebugLevel)
	zapTk := NewZapAnonymousTracker(zap.New(core), 2) // 2/s cap
	promTk := NewPrometheusAnonymousTracker(prometheus.NewRegistry())
	composite := NewCompositeAnonymousTracker(zapTk, promTk)

	gc, _ := gin.CreateTestContext(httptest.NewRecorder())
	gc.Request = httptest.NewRequest(http.MethodGet, "/ping", nil)
	gc.Request.RemoteAddr = "10.0.0.1:1"

	for i := 0; i < 10; i++ {
		composite.Track(gc, http.MethodGet, "/ping", "no-authorization-header")
	}
	// Zap capped at 2; Prometheus counts all 10.
	if logs.Len() != 2 {
		t.Errorf("expected 2 zap entries (rate-limited), got %d", logs.Len())
	}
	if got := testutil.ToFloat64(promTk.Counter().WithLabelValues(http.MethodGet, "/ping", "no-authorization-header")); got != 10 {
		t.Errorf("expected prom counter=10 (unbounded), got %v", got)
	}
}
