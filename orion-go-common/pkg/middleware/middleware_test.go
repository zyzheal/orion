package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func TestRequestID_GeneratesNew(t *testing.T) {
	router := gin.New()
	router.Use(RequestID())
	router.GET("/test", func(c *gin.Context) {
		rid := GetRequestID(c)
		if rid == "" {
			t.Error("expected non-empty request ID")
		}
		c.String(200, "ok")
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Errorf("expected 200, got %d", w.Code)
	}
	if w.Header().Get("X-Request-ID") == "" {
		t.Error("expected X-Request-ID header")
	}
}

func TestRequestID_PreservesExisting(t *testing.T) {
	router := gin.New()
	router.Use(RequestID())
	router.GET("/test", func(c *gin.Context) {
		rid := GetRequestID(c)
		if rid != "existing-id" {
			t.Errorf("expected 'existing-id', got %q", rid)
		}
		c.String(200, "ok")
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("X-Request-ID", "existing-id")
	router.ServeHTTP(w, req)

	if w.Header().Get("X-Request-ID") != "existing-id" {
		t.Errorf("expected preserved request ID, got %q", w.Header().Get("X-Request-ID"))
	}
}

func TestStructuredLogger(t *testing.T) {
	logger := zap.NewNop()
	router := gin.New()
	router.Use(StructuredLogger(logger))
	router.GET("/test", func(c *gin.Context) {
		c.String(200, "ok")
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestCORS_Default(t *testing.T) {
	router := gin.New()
	router.Use(CORS(DefaultCORSConfig()))
	router.GET("/test", func(c *gin.Context) {
		c.String(200, "ok")
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Origin", "http://example.com")
	router.ServeHTTP(w, req)

	if w.Header().Get("Access-Control-Allow-Origin") != "*" {
		t.Errorf("expected *, got %q", w.Header().Get("Access-Control-Allow-Origin"))
	}
}

func TestCORS_Preflight(t *testing.T) {
	router := gin.New()
	router.Use(CORS(DefaultCORSConfig()))
	router.GET("/test", func(c *gin.Context) {
		c.String(200, "ok")
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest("OPTIONS", "/test", nil)
	req.Header.Set("Origin", "http://example.com")
	router.ServeHTTP(w, req)

	if w.Code != 204 {
		t.Errorf("expected 204, got %d", w.Code)
	}
}

func TestCORS_RestrictedOrigins(t *testing.T) {
	cfg := CORSConfig{
		AllowOrigins: []string{"http://allowed.com"},
		AllowMethods: []string{"GET"},
		AllowHeaders: []string{"Authorization"},
	}
	router := gin.New()
	router.Use(CORS(cfg))
	router.GET("/test", func(c *gin.Context) {
		c.String(200, "ok")
	})

	// Allowed origin
	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Origin", "http://allowed.com")
	router.ServeHTTP(w, req)

	if w.Header().Get("Access-Control-Allow-Origin") != "http://allowed.com" {
		t.Errorf("expected allowed origin, got %q", w.Header().Get("Access-Control-Allow-Origin"))
	}

	// Disallowed origin — should not set CORS headers
	w = httptest.NewRecorder()
	req = httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Origin", "http://evil.com")
	router.ServeHTTP(w, req)

	if w.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Errorf("expected no CORS header for disallowed origin, got %q", w.Header().Get("Access-Control-Allow-Origin"))
	}
}

func TestRecovery(t *testing.T) {
	logger := zap.NewNop()
	router := gin.New()
	router.Use(Recovery(logger))
	router.GET("/panic", func(c *gin.Context) {
		panic("test panic")
	})
	router.GET("/ok", func(c *gin.Context) {
		c.String(200, "ok")
	})

	// Panic should be recovered
	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/panic", nil)
	router.ServeHTTP(w, req)

	if w.Code != 500 {
		t.Errorf("expected 500 after panic, got %d", w.Code)
	}

	// Normal request should work
	w = httptest.NewRecorder()
	req = httptest.NewRequest("GET", "/ok", nil)
	router.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHealthCheck(t *testing.T) {
	router := gin.New()
	router.GET("/healthz", HealthCheck("test-svc"))

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/healthz", nil)
	router.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestGetRequestID_Empty(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	rid := GetRequestID(c)
	if rid != "" {
		t.Errorf("expected empty request ID, got %q", rid)
	}
}

func TestJoinStrings(t *testing.T) {
	tests := []struct {
		input    []string
		expected string
	}{
		{nil, ""},
		{[]string{}, ""},
		{[]string{"GET"}, "GET"},
		{[]string{"GET", "POST"}, "GET, POST"},
		{[]string{"GET", "POST", "DELETE"}, "GET, POST, DELETE"},
	}
	for _, tt := range tests {
		result := joinStrings(tt.input)
		if result != tt.expected {
			t.Errorf("joinStrings(%v) = %q, want %q", tt.input, result, tt.expected)
		}
	}
}

func TestItoa(t *testing.T) {
	tests := []struct {
		input    int
		expected string
	}{
		{0, "0"},
		{1, "1"},
		{42, "42"},
		{86400, "86400"},
	}
	for _, tt := range tests {
		result := itoa(tt.input)
		if result != tt.expected {
			t.Errorf("itoa(%d) = %q, want %q", tt.input, result, tt.expected)
		}
	}
}

// Compile-time check that middleware implements http.Handler interface via gin.
var _ http.Handler = &gin.Engine{}
