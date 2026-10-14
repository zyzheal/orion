package middleware

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func newTestRouter(cache *IdempotencyCache) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("tenant_id", "t1")
		c.Next()
	})
	r.Use(Idempotency(cache))
	r.POST("/items", func(c *gin.Context) {
		c.JSON(http.StatusCreated, gin.H{"id": "new-1", "name": "test"})
	})
	return r
}

func TestIdempotency_NoKey_Passes(t *testing.T) {
	cache := NewIdempotencyCache(5 * time.Minute)
	r := newTestRouter(cache)

	req := httptest.NewRequest("POST", "/items", bytes.NewBufferString(`{"name":"test"}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d", w.Code)
	}
}

func TestIdempotency_SameKey_ReturnsCached(t *testing.T) {
	cache := NewIdempotencyCache(5 * time.Minute)
	r := newTestRouter(cache)

	body := `{"name":"test"}`

	// First request
	req1 := httptest.NewRequest("POST", "/items", bytes.NewBufferString(body))
	req1.Header.Set("Content-Type", "application/json")
	req1.Header.Set("X-Idempotency-Key", "abc-123")
	w1 := httptest.NewRecorder()
	r.ServeHTTP(w1, req1)
	if w1.Code != http.StatusCreated {
		t.Fatalf("expected 201 first, got %d", w1.Code)
	}

	// Second request with same key — should return cached
	req2 := httptest.NewRequest("POST", "/items", bytes.NewBufferString(body))
	req2.Header.Set("Content-Type", "application/json")
	req2.Header.Set("X-Idempotency-Key", "abc-123")
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)
	if w2.Code != http.StatusCreated {
		t.Errorf("expected 201 cached, got %d", w2.Code)
	}
	if !bytes.Equal(w1.Body.Bytes(), w2.Body.Bytes()) {
		t.Errorf("cached body should match: %s vs %s", w1.Body.String(), w2.Body.String())
	}
}

func TestIdempotency_DifferentKey_Processes(t *testing.T) {
	cache := NewIdempotencyCache(5 * time.Minute)
	r := newTestRouter(cache)

	body := `{"name":"test"}`

	// First request
	req1 := httptest.NewRequest("POST", "/items", bytes.NewBufferString(body))
	req1.Header.Set("Content-Type", "application/json")
	req1.Header.Set("X-Idempotency-Key", "key-1")
	w1 := httptest.NewRecorder()
	r.ServeHTTP(w1, req1)

	// Second request with different key — should process normally
	req2 := httptest.NewRequest("POST", "/items", bytes.NewBufferString(body))
	req2.Header.Set("Content-Type", "application/json")
	req2.Header.Set("X-Idempotency-Key", "key-2")
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)

	if w2.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d", w2.Code)
	}
}

func TestIdempotency_DifferentTenant_SameKey_Processes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cache := NewIdempotencyCache(5 * time.Minute)

	r := gin.New()
	r.Use(func(c *gin.Context) {
		// Alternate tenant
		if c.GetHeader("X-Tenant") == "t2" {
			c.Set("tenant_id", "t2")
		} else {
			c.Set("tenant_id", "t1")
		}
		c.Next()
	})
	r.Use(Idempotency(cache))
	r.POST("/items", func(c *gin.Context) {
		c.JSON(http.StatusCreated, gin.H{"id": "new"})
	})

	// First request (tenant t1)
	req1 := httptest.NewRequest("POST", "/items", bytes.NewBufferString(`{}`))
	req1.Header.Set("X-Idempotency-Key", "shared-key")
	w1 := httptest.NewRecorder()
	r.ServeHTTP(w1, req1)

	// Second request (tenant t2) — same key but different tenant
	req2 := httptest.NewRequest("POST", "/items", bytes.NewBufferString(`{}`))
	req2.Header.Set("X-Idempotency-Key", "shared-key")
	req2.Header.Set("X-Tenant", "t2")
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)

	// Both should be processed (different cache keys)
	if w1.Code != http.StatusCreated {
		t.Errorf("expected 201 for t1, got %d", w1.Code)
	}
	if w2.Code != http.StatusCreated {
		t.Errorf("expected 201 for t2, got %d", w2.Code)
	}
}

func TestIdempotCache_Expiry(t *testing.T) {
	cache := NewIdempotencyCache(10 * time.Millisecond)
	key := "test-key"
	cache.set(key, &idempotencyEntry{
		statusCode: 201,
		body:       []byte(`{"ok":true}`),
	})

	// Should exist immediately
	if _, ok := cache.get(key); !ok {
		t.Fatal("expected entry to exist")
	}

	// Wait for expiry
	time.Sleep(20 * time.Millisecond)

	// Should be expired
	if _, ok := cache.get(key); ok {
		t.Fatal("expected entry to be expired")
	}
}
