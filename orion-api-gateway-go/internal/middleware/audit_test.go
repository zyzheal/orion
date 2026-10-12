package middleware

import (
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"go.uber.org/zap/zaptest/observer"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// newCapturingLogger uses zaptest/observer to record log entries so
// tests can assert the audit trail fired with the expected fields.
func newCapturingLogger() (*zap.Logger, *observer.ObservedLogs) {
	core, observed := observer.New(zapcore.DebugLevel)
	return zap.New(core), observed
}

// findField scans the captured entries for a field with the given key
// and returns its String value (or nil if absent / non-string). Uses
// All() (non-consuming) rather than TakeAll so multiple assertions on
// the same ObservedLogs work.
func findField(obs *observer.ObservedLogs, name string) interface{} {
	for _, e := range obs.All() {
		for _, f := range e.Context {
			if f.Key == name {
				return f.String
			}
		}
	}
	return nil
}

// countEntries returns the number of observed log entries.
func countEntries(obs *observer.ObservedLogs) int {
	return obs.Len()
}

// setEnv saves the previous value and returns a restore func.
func setEnv(key, val string) func() {
	old, had := os.LookupEnv(key)
	os.Setenv(key, val)
	return func() {
		if had {
			os.Setenv(key, old)
		} else {
			os.Unsetenv(key)
		}
	}
}

// TestProxyAudit_NilLoggerPassesThrough verifies the middleware is nil-safe.
func TestProxyAudit_NilLoggerPassesThrough(t *testing.T) {
	mw := ProxyAudit(nil)
	r := gin.New()
	r.Use(mw)
	called := false
	r.POST("/api/v1/x", func(c *gin.Context) {
		called = true
		c.Status(http.StatusCreated)
	})
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/x", nil)
	r.ServeHTTP(w, req)
	if !called || w.Code != http.StatusCreated {
		t.Fatalf("handler should run: called=%v status=%d", called, w.Code)
	}
}

// TestProxyAudit_SkipsDisabledByFlag verifies GATEWAY_AUDIT_ENABLED=0
// short-circuits before any log emission.
func TestProxyAudit_SkipsDisabledByFlag(t *testing.T) {
	logger, obs := newCapturingLogger()
	defer setEnv("GATEWAY_AUDIT_ENABLED", "0")()

	mw := ProxyAudit(logger)
	r := gin.New()
	r.Use(mw)
	r.POST("/api/v1/x", func(c *gin.Context) { c.Status(http.StatusCreated) })
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/x", nil)
	r.ServeHTTP(w, req)

	if n := countEntries(obs); n != 0 {
		t.Fatalf("expected 0 entries when disabled, got %d", n)
	}
}

// TestProxyAudit_SkipsMutatingOnlyByDefaultConfirms GET requests are
// not logged by default (mutatingOnly default on).
func TestProxyAudit_SkipsMutatingOnlyByDefault(t *testing.T) {
	logger, obs := newCapturingLogger()
	defer setEnv("GATEWAY_AUDIT_ENABLED", "1")()
	defer setEnv("GATEWAY_AUDIT_MUTATING_ONLY", "1")()

	mw := ProxyAudit(logger)
	r := gin.New()
	r.Use(mw)
	r.GET("/api/v1/widgets", func(c *gin.Context) { c.Status(http.StatusOK) })
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/widgets", nil)
	r.ServeHTTP(w, req)

	if n := countEntries(obs); n != 0 {
		t.Fatalf("GET should be skipped by default; got %d entries", n)
	}
}

// TestProxyAudit_LogsMutatingRequestEmitsOne audit line per POST
// request with the expected tenant_id / user_id / status / duration fields.
func TestProxyAudit_LogsMutatingRequest(t *testing.T) {
	t.Cleanup(setEnv("GATEWAY_AUDIT_ENABLED", "1"))
	t.Cleanup(setEnv("GATEWAY_AUDIT_MUTATING_ONLY", "1"))
	logger, obs := newCapturingLogger()

	mw := ProxyAudit(logger)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("request_id", "r-1")
		c.Set("tenant_id", "t-1")
		c.Set("user_id", "u-1")
		c.Next()
	})
	r.Use(mw)
	r.POST("/api/v1/widgets", func(c *gin.Context) { c.Status(http.StatusCreated) })
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/widgets", strings.NewReader(`{"name":"w"}`))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if n := countEntries(obs); n != 1 {
		t.Fatalf("expected 1 audit entry, got %d", n)
	}
	if s := findField(obs, "tenant_id"); s != "t-1" {
		t.Fatalf("tenant_id field = %v, want t-1", s)
	}
	if s := findField(obs, "user_id"); s != "u-1" {
		t.Fatalf("user_id field = %v, want u-1", s)
	}
	if s := findField(obs, "request_id"); s != "r-1" {
		t.Fatalf("request_id field = %v, want r-1", s)
	}
	if s := findField(obs, "method"); s != "POST" {
		t.Fatalf("method field = %v, want POST", s)
	}
}

// TestProxyAudit_HeaderFallback verifies tenant/user are pulled from
// X-Tenant-ID / X-User-ID headers when the gin context is empty.
func TestProxyAudit_HeaderFallback(t *testing.T) {
	logger, obs := newCapturingLogger()
	defer setEnv("GATEWAY_AUDIT_ENABLED", "1")()
	defer setEnv("GATEWAY_AUDIT_MUTATING_ONLY", "0")()

	mw := ProxyAudit(logger)
	r := gin.New()
	r.Use(mw)
	r.GET("/api/v1/public", func(c *gin.Context) { c.Status(http.StatusOK) })
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/public", nil)
	req.Header.Set("X-Tenant-ID", "t-header")
	req.Header.Set("X-User-ID", "u-header")
	r.ServeHTTP(w, req)

	if n := countEntries(obs); n != 1 {
		t.Fatalf("expected 1 entry, got %d", n)
	}
	if s := findField(obs, "tenant_id"); s != "t-header" {
		t.Fatalf("tenant_id fallback = %v, want t-header", s)
	}
	if s := findField(obs, "user_id"); s != "u-header" {
		t.Fatalf("user_id fallback = %v, want u-header", s)
	}
}

// TestProxyAudit_SkipsHealthMetrics ensures default skip list is honored.
func TestProxyAudit_SkipsHealthMetrics(t *testing.T) {
	logger, obs := newCapturingLogger()
	defer setEnv("GATEWAY_AUDIT_ENABLED", "1")()
	defer setEnv("GATEWAY_AUDIT_MUTATING_ONLY", "0")()

	mw := ProxyAudit(logger)
	r := gin.New()
	r.Use(mw)
	r.POST("/health", func(c *gin.Context) { c.Status(http.StatusOK) })
	r.GET("/metrics", func(c *gin.Context) { c.Status(http.StatusOK) })
	for _, path := range []string{"/health", "/metrics"} {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, path, nil)
		r.ServeHTTP(w, req)
	}
	if n := countEntries(obs); n != 0 {
		t.Fatalf("health/metrics should be skipped; got %d entries", n)
	}
}

// TestProxyAudit_SkipPathsEnvExtra verifies the GATEWAY_AUDIT_SKIP_PATHS
// env override works in addition to the default list.
func TestProxyAudit_SkipPathsEnvExtra(t *testing.T) {
	logger, obs := newCapturingLogger()
	defer setEnv("GATEWAY_AUDIT_ENABLED", "1")()
	defer setEnv("GATEWAY_AUDIT_MUTATING_ONLY", "0")()
	defer setEnv("GATEWAY_AUDIT_SKIP_PATHS", "/api/v1/custom")()

	mw := ProxyAudit(logger)
	r := gin.New()
	r.Use(mw)
	r.POST("/api/v1/custom", func(c *gin.Context) { c.Status(http.StatusCreated) })
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/custom", nil)
	r.ServeHTTP(w, req)

	if n := countEntries(obs); n != 0 {
		t.Fatalf("env-skip path should not emit; got %d entries", n)
	}
}

// TestProxyAudit_AllMethodsLogs verifies when mutating-only is off, GET
// is still logged.
func TestProxyAudit_AllMethodsLogs(t *testing.T) {
	logger, obs := newCapturingLogger()
	defer setEnv("GATEWAY_AUDIT_ENABLED", "1")()
	defer setEnv("GATEWAY_AUDIT_MUTATING_ONLY", "0")()

	mw := ProxyAudit(logger)
	r := gin.New()
	r.Use(mw)
	r.GET("/api/v1/x", func(c *gin.Context) { c.Status(http.StatusOK) })
	r.POST("/api/v1/y", func(c *gin.Context) { c.Status(http.StatusCreated) })
	for _, tc := range []struct {
		method, path string
	}{
		{http.MethodGet, "/api/v1/x"},
		{http.MethodPost, "/api/v1/y"},
	} {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(tc.method, tc.path, nil)
		r.ServeHTTP(w, req)
	}
	if n := countEntries(obs); n != 2 {
		t.Fatalf("expected 2 entries, got %d", n)
	}
}

// TestIsMutatingMethod covers every branch of the classifier.
func TestIsMutatingMethod(t *testing.T) {
	mut := []string{"POST", "PUT", "PATCH", "DELETE", "post", "delete"}
	for _, m := range mut {
		if !isMutatingMethod(m) {
			t.Fatalf("expected %q to be mutating", m)
		}
	}
	nonMut := []string{"GET", "HEAD", "OPTIONS", "CONNECT", "TRACE"}
	for _, m := range nonMut {
		if isMutatingMethod(m) {
			t.Fatalf("expected %q NOT to be mutating", m)
		}
	}
}

// TestEnvBool covers every branch of the boolean env parser.
func TestEnvBool(t *testing.T) {
	cases := []struct {
		val  string
		def  bool
		want bool
	}{
		{"", true, true},
		{"1", false, true},
		{"true", false, true},
		{"TRUE", false, true},
		{"0", true, false},
		{"false", true, false},
		{"FALSE", true, false},
		{"garbage", true, true},
	}
	for _, tc := range cases {
		defer setEnv("TEST_AUDIT_BOOL", tc.val)()
		got := envBool("TEST_AUDIT_BOOL", tc.def)
		if got != tc.want {
			t.Fatalf("envBool(%q, %v) = %v, want %v", tc.val, tc.def, got, tc.want)
		}
	}
}
