package idempotency

import (
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func setupRouter(m gin.HandlerFunc) *gin.Engine {
	r := gin.New()
	r.Use(m)
	r.POST("/submit", func(c *gin.Context) {
		c.JSON(201, gin.H{"status": "ok"})
	})
	r.PUT("/update", func(c *gin.Context) {
		c.JSON(200, gin.H{"updated": true})
	})
	r.DELETE("/remove", func(c *gin.Context) {
		c.Status(204)
	})
	r.GET("/read", func(c *gin.Context) {
		c.JSON(200, gin.H{"data": "read"})
	})
	return r
}

func TestMiddlewareIdempotentReplay(t *testing.T) {
	store := NewMemoryStore()
	var callCount int64
	r := gin.New()
	r.Use(Middleware(WithStore(store), WithTTL(time.Hour)))
	r.POST("/submit", func(c *gin.Context) {
		atomic.AddInt64(&callCount, 1)
		c.JSON(201, gin.H{"attempt": atomic.LoadInt64(&callCount)})
	})

	// First request.
	req1 := httptest.NewRequest(http.MethodPost, "/submit", nil)
	req1.Header.Set("Idempotency-Key", "k1")
	w1 := httptest.NewRecorder()
	r.ServeHTTP(w1, req1)

	if w1.Code != 201 {
		t.Fatalf("first request: expected 201, got %d", w1.Code)
	}
	if atomic.LoadInt64(&callCount) != 1 {
		t.Fatalf("handler should be called once, got %d", atomic.LoadInt64(&callCount))
	}

	// Second request with same key.
	req2 := httptest.NewRequest(http.MethodPost, "/submit", nil)
	req2.Header.Set("Idempotency-Key", "k1")
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)

	if w2.Code != 201 {
		t.Fatalf("replay: expected 201, got %d", w2.Code)
	}
	if atomic.LoadInt64(&callCount) != 1 {
		t.Fatalf("handler should NOT be called again, got %d", atomic.LoadInt64(&callCount))
	}
	if w2.Header().Get(IdempotencyReplayHeader) != "true" {
		t.Fatal("missing replay header")
	}
}

func TestMiddlewareDifferentKey(t *testing.T) {
	var callCount int64
	r := gin.New()
	r.Use(Middleware())
	r.POST("/submit", func(c *gin.Context) {
		atomic.AddInt64(&callCount, 1)
		c.JSON(200, gin.H{})
	})

	for _, key := range []string{"a", "b", "c"} {
		req := httptest.NewRequest(http.MethodPost, "/submit", nil)
		req.Header.Set("Idempotency-Key", key)
		r.ServeHTTP(httptest.NewRecorder(), req)
	}
	if atomic.LoadInt64(&callCount) != 3 {
		t.Fatalf("expected 3 calls, got %d", atomic.LoadInt64(&callCount))
	}
}

func TestMiddlewareExcludesGET(t *testing.T) {
	var callCount int64
	r := gin.New()
	r.Use(Middleware())
	r.GET("/read", func(c *gin.Context) {
		atomic.AddInt64(&callCount, 1)
		c.JSON(200, gin.H{})
	})

	for i := 0; i < 3; i++ {
		req := httptest.NewRequest(http.MethodGet, "/read", nil)
		req.Header.Set("Idempotency-Key", "same")
		r.ServeHTTP(httptest.NewRecorder(), req)
	}
	if atomic.LoadInt64(&callCount) != 3 {
		t.Fatalf("GET should bypass middleware, got %d", atomic.LoadInt64(&callCount))
	}
}

func TestMiddlewareExcludePath(t *testing.T) {
	var callCount int64
	r := gin.New()
	r.Use(Middleware(WithExcludePaths("/webhook")))
	r.POST("/webhook/pay", func(c *gin.Context) {
		atomic.AddInt64(&callCount, 1)
		c.JSON(200, gin.H{})
	})

	for i := 0; i < 3; i++ {
		req := httptest.NewRequest(http.MethodPost, "/webhook/pay", nil)
		req.Header.Set("Idempotency-Key", "same")
		r.ServeHTTP(httptest.NewRecorder(), req)
	}
	if atomic.LoadInt64(&callCount) != 3 {
		t.Fatalf("excluded path should bypass, got %d", atomic.LoadInt64(&callCount))
	}
}

func TestMiddlewareRequiredHeader(t *testing.T) {
	r := gin.New()
	r.Use(Middleware(WithRequiredHeader()))
	r.POST("/submit", func(c *gin.Context) { c.JSON(200, gin.H{}) })

	req := httptest.NewRequest(http.MethodPost, "/submit", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != 400 {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestMiddlewareCustomKeyExtractor(t *testing.T) {
	store := NewMemoryStore()
	var callCount int64
	r := gin.New()
	r.Use(Middleware(WithStore(store), WithKeyExtractor(func(c *gin.Context) string {
		return "fixed"
	})))
	r.POST("/submit", func(c *gin.Context) {
		atomic.AddInt64(&callCount, 1)
		c.JSON(200, gin.H{})
	})

	for i := 0; i < 3; i++ {
		req := httptest.NewRequest(http.MethodPost, "/submit", nil)
		// No header — extractor provides key.
		r.ServeHTTP(httptest.NewRecorder(), req)
	}
	if atomic.LoadInt64(&callCount) != 1 {
		t.Fatalf("expected 1 call with fixed key, got %d", atomic.LoadInt64(&callCount))
	}
}

func TestMiddlewareAutoKey(t *testing.T) {
	store := NewMemoryStore()
	var callCount int64
	r := gin.New()
	r.Use(Middleware(WithStore(store)))
	r.POST("/submit", func(c *gin.Context) {
		atomic.AddInt64(&callCount, 1)
		c.JSON(200, gin.H{})
	})

	// Two identical requests (no explicit key) should deduplicate via auto-key.
	for i := 0; i < 2; i++ {
		req := httptest.NewRequest(http.MethodPost, "/submit", nil)
		r.ServeHTTP(httptest.NewRecorder(), req)
	}
	if atomic.LoadInt64(&callCount) != 1 {
		t.Fatalf("auto-key should deduplicate, got %d", atomic.LoadInt64(&callCount))
	}
}

func TestMiddlewareOnlyCachesSuccess(t *testing.T) {
	store := NewMemoryStore()
	var callCount int64
	r := gin.New()
	r.Use(Middleware(WithStore(store)))
	r.POST("/submit", func(c *gin.Context) {
		atomic.AddInt64(&callCount, 1)
		c.JSON(500, gin.H{"error": "boom"})
	})

	req1 := httptest.NewRequest(http.MethodPost, "/submit", nil)
	req1.Header.Set("Idempotency-Key", "fail")
	r.ServeHTTP(httptest.NewRecorder(), req1)

	req2 := httptest.NewRequest(http.MethodPost, "/submit", nil)
	req2.Header.Set("Idempotency-Key", "fail")
	r.ServeHTTP(httptest.NewRecorder(), req2)

	if atomic.LoadInt64(&callCount) != 2 {
		t.Fatalf("500 should NOT be cached, handler called %d times", atomic.LoadInt64(&callCount))
	}
}
