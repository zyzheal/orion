package proxy

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func init() { gin.SetMode(gin.TestMode) }

// closeNotifyRecorder wraps httptest.ResponseRecorder to implement http.CloseNotifier
type closeNotifyRecorder struct {
	*httptest.ResponseRecorder
}

func (c *closeNotifyRecorder) CloseNotify() <-chan bool {
	return make(chan bool)
}

func newTestRecorder() *closeNotifyRecorder {
	return &closeNotifyRecorder{ResponseRecorder: httptest.NewRecorder()}
}

func TestNewReverseProxy(t *testing.T) {
	target, _ := url.Parse("http://upstream:8080")
	proxy := NewReverseProxy(target, zap.NewNop())
	if proxy == nil {
		t.Fatal("expected non-nil proxy")
	}
	if proxy.Director == nil {
		t.Error("expected non-nil Director")
	}
	if proxy.ErrorHandler == nil {
		t.Error("expected non-nil ErrorHandler")
	}
}

func TestReverseProxyDirector(t *testing.T) {
	target, _ := url.Parse("http://upstream:8080")
	proxy := NewReverseProxy(target, zap.NewNop())

	req, _ := http.NewRequest("GET", "http://gateway.example.com/api/test", nil)
	proxy.Director(req)

	if req.URL.Scheme != "http" {
		t.Errorf("expected scheme http, got %s", req.URL.Scheme)
	}
	if req.URL.Host != "upstream:8080" {
		t.Errorf("expected host upstream:8080, got %s", req.URL.Host)
	}
	if req.Host != "upstream:8080" {
		t.Errorf("expected req.Host upstream:8080, got %s", req.Host)
	}
}

func TestReverseProxyErrorHandler(t *testing.T) {
	target, _ := url.Parse("http://upstream:8080")
	proxy := NewReverseProxy(target, zap.NewNop())

	rr := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	proxy.ErrorHandler(rr, req, fmt.Errorf("test error"))

	if rr.Code != http.StatusBadGateway {
		t.Errorf("expected 502, got %d", rr.Code)
	}
	body := rr.Body.String()
	if body != `{"code":502,"message":"upstream service unavailable"}` {
		t.Errorf("unexpected body: %s", body)
	}
}

func TestHandlerBasic(t *testing.T) {
	// Create mock upstream
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, "upstream-ok")
	}))
	defer upstream.Close()

	target, _ := url.Parse(upstream.URL)
	proxy := NewReverseProxy(target, zap.NewNop())

	// Create test route
	r := gin.New()
	r.GET("/prefix/*path", Handler(proxy, "/prefix", zap.NewNop()))

	// Test request
	rr := newTestRecorder()
	req := httptest.NewRequest("GET", "/prefix/hello", nil)
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rr.Code)
	}
	if rr.Body.String() != "upstream-ok" {
		t.Errorf("expected upstream-ok, got %s", rr.Body.String())
	}
}

func TestHandlerForwardsTenantID(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tid := r.Header.Get("X-Tenant-ID")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, "tid="+tid)
	}))
	defer upstream.Close()

	target, _ := url.Parse(upstream.URL)
	proxy := NewReverseProxy(target, zap.NewNop())
	r := gin.New()

	r.GET("/prefix/*path", func(c *gin.Context) {
		c.Set("tenant_id", "tenant-abc")
		c.Set("request_id", "req-123")
		Handler(proxy, "/prefix", zap.NewNop())(c)
	})

	rr := newTestRecorder()
	req := httptest.NewRequest("GET", "/prefix/test", nil)
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rr.Code)
	}
	if rr.Body.String() != "tid=tenant-abc" {
		t.Errorf("expected tenant-abc forwarded, got %s", rr.Body.String())
	}
}

func TestHandlerForwardsRequestID(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rid := r.Header.Get("X-Request-ID")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, "rid="+rid)
	}))
	defer upstream.Close()

	target, _ := url.Parse(upstream.URL)
	proxy := NewReverseProxy(target, zap.NewNop())
	r := gin.New()

	r.GET("/prefix/*path", func(c *gin.Context) {
		c.Set("request_id", "req-456")
		Handler(proxy, "/prefix", zap.NewNop())(c)
	})

	rr := newTestRecorder()
	req := httptest.NewRequest("GET", "/prefix/test", nil)
	r.ServeHTTP(rr, req)

	if rr.Body.String() != "rid=req-456" {
		t.Errorf("expected req-456 forwarded, got %s", rr.Body.String())
	}
}

func TestHandlerNoTenantID(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tid := r.Header.Get("X-Tenant-ID")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, fmt.Sprintf("tid=%q", tid))
	}))
	defer upstream.Close()

	target, _ := url.Parse(upstream.URL)
	proxy := NewReverseProxy(target, zap.NewNop())
	r := gin.New()
	r.GET("/prefix/*path", Handler(proxy, "/prefix", zap.NewNop()))

	rr := newTestRecorder()
	req := httptest.NewRequest("GET", "/prefix/test", nil)
	r.ServeHTTP(rr, req)

	// No tenant_id set, so X-Tenant-ID should be empty
	if rr.Body.String() != `tid=""` {
		t.Errorf("expected empty tenant ID, got %s", rr.Body.String())
	}
}

func TestSSEHandlerConfig(t *testing.T) {
	cfg := &SSEHandlerConfig{UpstreamBaseURL: "http://upstream:8080"}
	if cfg.UpstreamBaseURL != "http://upstream:8080" {
		t.Errorf("unexpected base URL: %s", cfg.UpstreamBaseURL)
	}
}

func TestSSEHandlerBasic(t *testing.T) {
	// Mock SSE upstream
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprint(w, "data: hello\n\n")
	}))
	defer upstream.Close()

	logger := zap.NewNop()
	cfg := &SSEHandlerConfig{UpstreamBaseURL: upstream.URL}

	r := gin.New()
	r.GET("/stream/*path", SSEHandler(logger, cfg))

	rr := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/stream/pipeline-1/logs", nil)
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rr.Code)
	}
	if rr.Header().Get("Content-Type") != "text/event-stream" {
		t.Errorf("expected text/event-stream, got %s", rr.Header().Get("Content-Type"))
	}
	if rr.Header().Get("Cache-Control") != "no-cache" {
		t.Errorf("expected no-cache, got %s", rr.Header().Get("Cache-Control"))
	}
}

func TestSSEHandlerForwardsAuth(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprint(w, fmt.Sprintf("data: auth=%s\n\n", auth))
	}))
	defer upstream.Close()

	logger := zap.NewNop()
	cfg := &SSEHandlerConfig{UpstreamBaseURL: upstream.URL}
	r := gin.New()
	r.GET("/stream/*path", SSEHandler(logger, cfg))

	rr := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/stream/test", nil)
	req.Header.Set("Authorization", "Bearer test-token")
	r.ServeHTTP(rr, req)

	body := rr.Body.String()
	if body != "data: auth=Bearer test-token\n\n" {
		t.Errorf("unexpected body: %s", body)
	}
}

func TestSSEHandlerWithQuery(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query().Get("level")
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprint(w, fmt.Sprintf("data: level=%s\n\n", q))
	}))
	defer upstream.Close()

	logger := zap.NewNop()
	cfg := &SSEHandlerConfig{UpstreamBaseURL: upstream.URL}
	r := gin.New()
	r.GET("/stream/*path", SSEHandler(logger, cfg))

	rr := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/stream/logs?level=debug", nil)
	r.ServeHTTP(rr, req)

	body := rr.Body.String()
	if body != "data: level=debug\n\n" {
		t.Errorf("unexpected body: %s", body)
	}
}
