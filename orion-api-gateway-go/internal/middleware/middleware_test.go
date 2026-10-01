package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func TestExtractToken_Bearer(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("GET", "/", nil)
	c.Request.Header.Set("Authorization", "Bearer mytoken123")

	token := extractToken(c)
	if token != "mytoken123" {
		t.Errorf("expected 'mytoken123', got '%s'", token)
	}
}

func TestExtractToken_APIKey(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("GET", "/", nil)
	c.Request.Header.Set("X-API-Key", "apikey123")

	token := extractToken(c)
	if token != "apikey123" {
		t.Errorf("expected 'apikey123', got '%s'", token)
	}
}

func TestExtractToken_QueryParam(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("GET", "/?token=querytoken", nil)

	token := extractToken(c)
	if token != "querytoken" {
		t.Errorf("expected 'querytoken', got '%s'", token)
	}
}

func TestExtractToken_None(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("GET", "/", nil)

	token := extractToken(c)
	if token != "" {
		t.Errorf("expected empty, got '%s'", token)
	}
}

func TestBlacklistCache_SetAndGet(t *testing.T) {
	cache := newBlacklistCache(5 * 1000_000_000) // 5 seconds

	// Miss
	_, found := cache.get("hash1")
	if found {
		t.Error("expected cache miss")
	}

	// Set
	cache.set("hash1", true)
	revoked, found := cache.get("hash1")
	if !found || !revoked {
		t.Error("expected revoked=true")
	}

	// Non-revoked
	cache.set("hash2", false)
	revoked, found = cache.get("hash2")
	if !found || revoked {
		t.Error("expected revoked=false")
	}
}

func TestHashToken(t *testing.T) {
	h1 := hashToken("test-token")
	h2 := hashToken("test-token")
	h3 := hashToken("different-token")

	if h1 != h2 {
		t.Error("same input should produce same hash")
	}
	if h1 == h3 {
		t.Error("different input should produce different hash")
	}
	if len(h1) != 64 { // SHA256 hex = 64 chars
		t.Errorf("expected 64 char hex, got %d", len(h1))
	}
}

func TestRequestID(t *testing.T) {
	r := gin.New()
	r.Use(RequestID())
	r.GET("/test", func(c *gin.Context) {
		id := c.GetString("request_id")
		if id == "" {
			t.Error("expected request_id to be set")
		}
		c.String(200, "ok")
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/test", nil)
	r.ServeHTTP(w, req)

	if w.Header().Get("X-Request-ID") == "" {
		t.Error("expected X-Request-ID header")
	}
}

func TestCORS(t *testing.T) {
	r := gin.New()
	r.Use(CORS([]string{"http://example.com"}))
	r.GET("/test", func(c *gin.Context) { c.String(200, "ok") })

	// Test matching origin
	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Origin", "http://example.com")
	r.ServeHTTP(w, req)

	if w.Header().Get("Access-Control-Allow-Origin") != "http://example.com" {
		t.Error("expected CORS header for matching origin")
	}

	// Test OPTIONS preflight
	w = httptest.NewRecorder()
	req = httptest.NewRequest("OPTIONS", "/test", nil)
	req.Header.Set("Origin", "http://example.com")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNoContent {
		t.Errorf("expected 204 for OPTIONS, got %d", w.Code)
	}
}

func TestTenantPropagation(t *testing.T) {
	r := gin.New()
	r.Use(TenantPropagation())
	r.GET("/test", func(c *gin.Context) {
		tid := c.GetString("tenant_id")
		if tid != "mytenant" {
			t.Errorf("expected 'mytenant', got '%s'", tid)
		}
		c.String(200, "ok")
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("X-Tenant-ID", "mytenant")
	r.ServeHTTP(w, req)
}

func TestTenantPropagation_Default(t *testing.T) {
	r := gin.New()
	r.Use(TenantPropagation())
	r.GET("/test", func(c *gin.Context) {
		tid := c.GetString("tenant_id")
		if tid != "default" {
			t.Errorf("expected 'default', got '%s'", tid)
		}
		c.String(200, "ok")
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/test", nil)
	r.ServeHTTP(w, req)
}
