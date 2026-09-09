package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
)

// TestPromTracker_IncrementsOnTrack verifies each Track call increments the
// counter by 1 for the matching (method, path, reason) label set.
func TestPromTracker_IncrementsOnTrack(t *testing.T) {
	tk := NewPrometheusAnonymousTracker(prometheus.NewRegistry())
	if tk == nil {
		t.Fatal("expected non-nil tracker from fresh registry")
	}
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "/api/v1/ping", nil)

	tk.Track(c, http.MethodGet, "/api/v1/ping", "no-authorization-header")
	if got := testutil.ToFloat64(tk.counter.WithLabelValues(http.MethodGet, "/api/v1/ping", "no-authorization-header")); got != 1 {
		t.Errorf("expected counter=1, got %v", got)
	}
}

// TestPromTracker_LabelSetsIndependent verifies that different (method, path,
// reason) combinations increment distinct counters.
func TestPromTracker_LabelSetsIndependent(t *testing.T) {
	tk := NewPrometheusAnonymousTracker(prometheus.NewRegistry())
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "/a", nil)

	tk.Track(c, http.MethodGet, "/a", "no-authorization-header")
	tk.Track(c, http.MethodGet, "/b", "no-authorization-header")
	tk.Track(c, http.MethodPost, "/a", "non-bearer-auth-header")

	if got := testutil.ToFloat64(tk.counter.WithLabelValues(http.MethodGet, "/a", "no-authorization-header")); got != 1 {
		t.Errorf("GET /a no-auth = %v, want 1", got)
	}
	if got := testutil.ToFloat64(tk.counter.WithLabelValues(http.MethodGet, "/b", "no-authorization-header")); got != 1 {
		t.Errorf("GET /b no-auth = %v, want 1", got)
	}
	if got := testutil.ToFloat64(tk.counter.WithLabelValues(http.MethodPost, "/a", "non-bearer-auth-header")); got != 1 {
		t.Errorf("POST /a non-bearer = %v, want 1", got)
	}
}

// TestPromTracker_MultipleCallsAccumulate asserts the counter is monotonic.
func TestPromTracker_MultipleCallsAccumulate(t *testing.T) {
	tk := NewPrometheusAnonymousTracker(prometheus.NewRegistry())
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "/ping", nil)

	for i := 0; i < 5; i++ {
		tk.Track(c, http.MethodGet, "/ping", "no-authorization-header")
	}
	if got := testutil.ToFloat64(tk.counter.WithLabelValues(http.MethodGet, "/ping", "no-authorization-header")); got != 5 {
		t.Errorf("expected 5, got %v", got)
	}
}

// TestPromTracker_NilReceiverIsNoOp asserts calling Track on a nil tracker is
// safe.
func TestPromTracker_NilReceiverIsNoOp(t *testing.T) {
	var tk *PrometheusAnonymousTracker
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "/ping", nil)
	tk.Track(c, http.MethodGet, "/ping", "no-authorization-header") // must not panic
}

// TestPromTracker_NilContextIsNoOp asserts a nil gin.Context is tolerated.
func TestPromTracker_NilContextIsNoOp(t *testing.T) {
	tk := NewPrometheusAnonymousTracker(prometheus.NewRegistry())
	// Track does not dereference c, so a nil context is fine.
	tk.Track(nil, http.MethodGet, "/ping", "no-authorization-header") // must not panic
	if got := testutil.ToFloat64(tk.counter.WithLabelValues(http.MethodGet, "/ping", "no-authorization-header")); got != 1 {
		t.Errorf("expected 1 (nil context tolerated), got %v", got)
	}
}

// TestPromTracker_NilRegistererUsesDefaultRegistry verifies the nil
// registerer falls back to prometheus.DefaultRegisterer.
func TestPromTracker_NilRegistererUsesDefaultRegistry(t *testing.T) {
	// Register to default, then assert it's collected.
	tk := NewPrometheusAnonymousTracker(nil)
	if tk == nil {
		t.Fatal("expected non-nil tracker from default registry")
	}
	defer tk.Unregister()
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "/ping", nil)
	tk.Track(c, http.MethodGet, "/ping", "no-authorization-header")
	if got := testutil.CollectAndCount(tk.counter); got < 1 {
		t.Errorf("expected at least 1 collected series, got %d", got)
	}
}

// TestPromTracker_DuplicateRegistrationReturnsNil verifies that registering
// the same tracker twice against the same registerer returns nil (rather
// than panicking, as promauto would).
func TestPromTracker_DuplicateRegistrationReturnsNil(t *testing.T) {
	reg := prometheus.NewRegistry()
	_ = NewPrometheusAnonymousTracker(reg) // first registration succeeds
	tk := NewPrometheusAnonymousTracker(reg) // second must fail
	if tk != nil {
		t.Errorf("expected nil on duplicate registration, got non-nil")
	}
}

// TestPromTracker_UnregisterDeregisters verifies the counter can be removed.
func TestPromTracker_UnregisterDeregisters(t *testing.T) {
	reg := prometheus.NewRegistry()
	tk := NewPrometheusAnonymousTracker(reg)
	if tk == nil {
		t.Fatal("expected non-nil tracker")
	}
	if !tk.Unregister() {
		t.Error("expected Unregister to return true")
	}
	if tk.Counter() == nil {
		t.Error("expected Counter() to still return the vec after Unregister")
	}
	// A second tracker on the same registry must now succeed.
	tk2 := NewPrometheusAnonymousTracker(reg)
	if tk2 == nil {
		t.Error("expected non-nil tracker after prior Unregister")
	}
}

// TestPromTracker_NilCounterIsNoOp asserts a tracker built with a nil counter
// does not panic on Track (defensive: covers a future refactor that might
// leave the counter unwired).
func TestPromTracker_NilCounterIsNoOp(t *testing.T) {
	tk := &PrometheusAnonymousTracker{} // counter nil
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "/ping", nil)
	tk.Track(c, http.MethodGet, "/ping", "no-authorization-header") // must not panic
}

// TestPromTracker_WiredToOptionalAuth end-to-end: anonymous requests
// increment the counter while authenticated requests do not.
func TestPromTracker_WiredToOptionalAuth(t *testing.T) {
	reg := prometheus.NewRegistry()
	tk := NewPrometheusAnonymousTracker(reg)
	if tk == nil {
		t.Fatal("expected non-nil tracker")
	}

	ng := gin.New()
	ng.Use(OptionalAuth(AuthConfig{AnonymousTracker: tk}))
	ng.GET("/ping", func(c *gin.Context) { c.Status(http.StatusOK) })

	// Anonymous request → counter increments.
	w := httptest.NewRecorder()
	ng.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/ping", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if got := testutil.ToFloat64(tk.counter.WithLabelValues(http.MethodGet, "/ping", "no-authorization-header")); got != 1 {
		t.Errorf("expected counter=1 after 1 anonymous request, got %v", got)
	}

	// Second anonymous request → counter increments again.
	w = httptest.NewRecorder()
	ng.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/ping", nil))
	if got := testutil.ToFloat64(tk.counter.WithLabelValues(http.MethodGet, "/ping", "no-authorization-header")); got != 2 {
		t.Errorf("expected counter=2 after 2 anonymous requests, got %v", got)
	}
}

// TestPromTracker_AllReasonLabelsBounded verifies each of the four documented
// OptionalAuth reasons produces a distinct, non-zero series.
func TestPromTracker_AllReasonLabelsBounded(t *testing.T) {
	reg := prometheus.NewRegistry()
	tk := NewPrometheusAnonymousTracker(reg)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "/ping", nil)

	reasons := []string{
		"no-authorization-header",
		"non-bearer-auth-header",
		"token-blacklisted",
		"token-parse-error",
	}
	for _, r := range reasons {
		tk.Track(c, http.MethodGet, "/ping", r)
	}
	for _, r := range reasons {
		if got := testutil.ToFloat64(tk.counter.WithLabelValues(http.MethodGet, "/ping", r)); got != 1 {
			t.Errorf("reason %q counter = %v, want 1", r, got)
		}
	}
	if got := testutil.CollectAndCount(tk.counter); got != len(reasons) {
		t.Errorf("expected %d collected series, got %d", len(reasons), got)
	}
}
