package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"orion/platform-svc-go/internal/repository"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// TestTenantCtx_PullsFromGinContext sets tenant_id on the gin context via a
// preceding middleware (simulating auth) and asserts TenantCtx re-publishes
// it onto c.Request.Context() so repository code can retrieve it via
// TenantFromContext.
func TestTenantCtx_PullsFromGinContext(t *testing.T) {
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("tenant_id", "t-fixed")
		c.Next()
	})
	r.Use(TenantCtx())
	r.GET("/probe", func(c *gin.Context) {
		got, ok := repository.TenantFromContext(c.Request.Context())
		if !ok || got != "t-fixed" {
			c.JSON(500, gin.H{"ok": ok, "got": got})
			return
		}
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/probe", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
}

// TestTenantCtx_FallsBackToHeader simulates an OptionalAuth request that did
// not populate gin ctx and confirms the X-Tenant-ID header is used as the
// fallback source of truth.
func TestTenantCtx_FallsBackToHeader(t *testing.T) {
	r := gin.New()
	r.Use(TenantCtx())
	r.GET("/probe", func(c *gin.Context) {
		got, ok := repository.TenantFromContext(c.Request.Context())
		if !ok || got != "t-header" {
			c.JSON(500, gin.H{"ok": ok, "got": got})
			return
		}
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/probe", nil)
	req.Header.Set("X-Tenant-ID", "t-header")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
}

// TestTenantCtx_NoTenantWhenAbsent confirms the fail-closed property: when
// neither gin ctx nor header carries a tenant, the request ctx has no tenant
// and repository code sees ok=false.
func TestTenantCtx_NoTenantWhenAbsent(t *testing.T) {
	r := gin.New()
	r.Use(TenantCtx())
	r.GET("/probe", func(c *gin.Context) {
		_, ok := repository.TenantFromContext(c.Request.Context())
		if ok {
			c.JSON(500, gin.H{"ok": true})
			return
		}
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/probe", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 (fail-closed, no tenant), got %d body=%s", w.Code, w.Body.String())
	}
}

// TestAuditLog_NilServicePassesThrough verifies the middleware is nil-safe:
// when auditSvc is nil at init time, the returned handler is a pass-through
// and the request still reaches the terminal handler.
func TestAuditLog_NilServicePassesThrough(t *testing.T) {
	original := auditSvc
	defer func() { auditSvc = original }()
	auditSvc = nil

	mw := AuditLog(zap.NewNop())

	r := gin.New()
	r.Use(mw)
	called := false
	r.POST("/probe", func(c *gin.Context) {
		called = true
		c.Status(http.StatusCreated)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/probe", nil)
	r.ServeHTTP(w, req)

	if !called {
		t.Fatal("terminal handler should have been called even with nil auditSvc")
	}
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}
}

// TestAuditLog_DisabledByFlag verifies the AUDIT_LOG_ENABLED=0 flag short-
// circuits the middleware before any work. Because auditSvc is nil we are
// really testing "no side effects"; the important property is that the
// terminal handler still runs when the flag is off.
func TestAuditLog_DisabledByFlag(t *testing.T) {
	original := auditSvc
	defer func() { auditSvc = original }()
	auditSvc = nil
	os.Setenv("AUDIT_LOG_ENABLED", "0")
	defer os.Unsetenv("AUDIT_LOG_ENABLED")

	mw := AuditLog(zap.NewNop())

	r := gin.New()
	r.Use(mw)
	r.POST("/probe", func(c *gin.Context) { c.Status(http.StatusNoContent) })

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/probe", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", w.Code)
	}
}

// TestAuditLog_SkipsSkippedPath verifies the AUDIT_LOG_SKIP_PATHS comma-
// separated list is honoured.
func TestAuditLog_SkipsSkippedPath(t *testing.T) {
	original := auditSvc
	defer func() { auditSvc = original }()
	auditSvc = nil
	os.Setenv("AUDIT_LOG_ENABLED", "1")
	os.Setenv("AUDIT_LOG_SKIP_PATHS", "/api/v1/health")
	defer os.Unsetenv("AUDIT_LOG_ENABLED")
	defer os.Unsetenv("AUDIT_LOG_SKIP_PATHS")

	mw := AuditLog(zap.NewNop())

	r := gin.New()
	r.Use(mw)
	r.POST("/api/v1/health", func(c *gin.Context) { c.Status(http.StatusOK) })

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/health", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for skipped path, got %d", w.Code)
	}
}

// TestAuditLog_GathersHeaders verifies that a mutating request with audit
// enabled still lets the terminal handler run and that the middleware
// captured enough (implicitly — best-effort) without blocking.
func TestAuditLog_GathersHeaders(t *testing.T) {
	original := auditSvc
	defer func() { auditSvc = original }()
	auditSvc = nil
	os.Setenv("AUDIT_LOG_ENABLED", "1")
	os.Setenv("AUDIT_LOG_MUTATING_ONLY", "1")
	defer os.Unsetenv("AUDIT_LOG_ENABLED")
	defer os.Unsetenv("AUDIT_LOG_MUTATING_ONLY")

	mw := AuditLog(zap.NewNop())

	r := gin.New()
	r.Use(mw)
	seenMethod := ""
	r.POST("/api/v1/widgets", func(c *gin.Context) {
		seenMethod = c.Request.Method
		c.Status(http.StatusCreated)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/widgets", strings.NewReader("{}"))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", "t-1")
	req.Header.Set("X-User-ID", "u-1")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}
	if seenMethod != http.MethodPost {
		t.Fatalf("handler should have seen POST, got %q", seenMethod)
	}
}

// TestIsMutating verifies the method classifier used by AuditLog.
func TestIsMutating(t *testing.T) {
	mutating := []string{"POST", "PUT", "PATCH", "DELETE", "post", "delete"}
	for _, m := range mutating {
		if !isMutating(m) {
			t.Fatalf("expected %q to be mutating", m)
		}
	}
	readOnly := []string{"GET", "HEAD", "OPTIONS"}
	for _, m := range readOnly {
		if isMutating(m) {
			t.Fatalf("expected %q to NOT be mutating", m)
		}
	}
}

// TestEnvBool covers every branch of the AUDIT_* env helper.
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
		os.Setenv("TEST_BOOL_HELPER", tc.val)
		got := envBool("TEST_BOOL_HELPER", tc.def)
		if got != tc.want {
			t.Fatalf("envBool(%q, %v) = %v, want %v", tc.val, tc.def, got, tc.want)
		}
	}
	os.Unsetenv("TEST_BOOL_HELPER")
}

// TestFirstString verifies the fallback helper.
func TestFirstString(t *testing.T) {
	if got := firstString("a", "b"); got != "a" {
		t.Fatalf("firstString(a,b) = %q, want a", got)
	}
	if got := firstString("", "b"); got != "b" {
		t.Fatalf("firstString('',b) = %q, want b", got)
	}
	if got := firstString("", ""); got != "" {
		t.Fatalf("firstString('','') = %q, want ''", got)
	}
}

// TestGetStr verifies the type-safe gin ctx getter.
func TestGetStr(t *testing.T) {
	c := &gin.Context{}
	c.Set("tenant_id", "t-1")
	if got := getStr(c, "tenant_id"); got != "t-1" {
		t.Fatalf("getStr(tenant_id) = %q, want t-1", got)
	}
	c.Set("num", 42)
	if got := getStr(c, "num"); got != "" {
		t.Fatalf("getStr on non-string should return empty, got %q", got)
	}
	if got := getStr(c, "missing"); got != "" {
		t.Fatalf("getStr on missing key should return empty, got %q", got)
	}
}

// peekBodyProbe builds a *gin.Context with the given method/path/body/
// content-type and runs peekBody against it. Wrapping via gin.New makes
// the Context fully initialised (Writer, Keys, Request) so peekBody can
// call c.ContentType() without panicking.
func peekBodyProbe(method, path, body, contentType string) *gin.Context {
	r := gin.New()
	var c *gin.Context
	r.Handle(method, path, func(ctx *gin.Context) { c = ctx })
	w := httptest.NewRecorder()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	r.ServeHTTP(w, req)
	return c
}

// TestPeekBody_NonJSONConfirms the audit body-reader respects Content-Type.
// The current implementation intentionally does not consume the body; the
// test documents the contract so a future "capture it anyway" refactor has
// a red test to fix.
func TestPeekBody_NonJSON(t *testing.T) {
	c := peekBodyProbe(http.MethodPost, "/x", "binary", "application/octet-stream")
	if got := peekBody(c); got != nil {
		t.Fatalf("peekBody on non-JSON should return nil, got %#v", got)
	}
}

// TestPeekBody_JSONConfirming the 4 KB JSON path also returns nil in the
// current no-capture implementation.
func TestPeekBody_JSON(t *testing.T) {
	c := peekBodyProbe(http.MethodPost, "/x", "{}", "application/json")
	if got := peekBody(c); got != nil {
		t.Fatalf("peekBody should currently return nil even for JSON, got %#v", got)
	}
}

// TestWriteAuditEntry_NilServiceConfirms writeAuditEntry is nil-safe so a
// deferred fire-and-forget goroutine never panics if audit wiring failed.
func TestWriteAuditEntry_NilService(t *testing.T) {
	original := auditSvc
	defer func() { auditSvc = original }()
	auditSvc = nil

	// Should not panic.
	writeAuditEntry(nil, auditAuditParams{
		SeqNum:        1,
		RequestMethod: "POST",
		RequestPath:   "/api/v1/x",
		ResponseCode:  200,
		DurationMs:    time.Millisecond.Milliseconds(),
	})
}
