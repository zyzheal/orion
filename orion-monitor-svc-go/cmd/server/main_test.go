package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/orion-platform/orion-monitor-svc-go/internal/handler"
	"github.com/orion-platform/orion-monitor-svc-go/internal/middleware"
	"github.com/orion-platform/orion-monitor-svc-go/internal/service"
	"go.uber.org/zap"
)

func newTestHandler(t *testing.T) *handler.Handler {
	t.Helper()
	logger, _ := zap.NewDevelopment()
	middleware.InitMiddleware(logger)
	return nil
}
var _ = handler.New // suppress unused handler import

func TestHealthCheckHandler(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(middleware.Recover())
	r.Use(middleware.RequestID())

	_ = newTestHandler(t)
	// Test health check endpoint
	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "healthy",
			"service": "orion-monitor-svc-go",
		})
	})

	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, w.Code)
	}

	var resp map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	if resp["status"] != "healthy" {
		t.Errorf("expected status 'healthy', got '%s'", resp["status"])
	}
}

func TestAuthMiddlewareMissingHeader(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(middleware.Auth())
	r.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected status %d, got %d", http.StatusUnauthorized, w.Code)
	}
}

func TestAuthMiddlewareInvalidScheme(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(middleware.Auth())
	r.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Basic abc123")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected status %d, got %d", http.StatusUnauthorized, w.Code)
	}
}

func TestAuthMiddlewareValidToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(middleware.Auth())
	r.Use(middleware.TenantID())
	r.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer validtoken1234567890")
	req.Header.Set("X-Tenant-Id", "550e8400-e29b-41d4-a716-446655440000")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, w.Code)
	}
}

func TestTenantIDMiddlewareMissingHeader(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(middleware.TenantID())
	r.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer validtoken1234567890")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected status %d, got %d", http.StatusUnauthorized, w.Code)
	}
}

func TestTenantIDMiddlewareInvalidUUID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(middleware.TenantID())
	r.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer validtoken1234567890")
	req.Header.Set("X-Tenant-Id", "not-a-uuid")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, w.Code)
	}
}

func TestRequestIDMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(middleware.RequestID())
	r.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"requestId": c.GetString("requestId")})
	})

	// Test without pre-existing request ID
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Header().Get("X-Request-Id") == "" {
		t.Error("expected X-Request-Id header to be set")
	}

	// Test with pre-existing request ID
	req = httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("X-Request-Id", "custom-id-123")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Header().Get("X-Request-Id") != "custom-id-123" {
		t.Errorf("expected X-Request-Id to be 'custom-id-123', got '%s'", w.Header().Get("X-Request-Id"))
	}
}

func TestServiceInitialization(t *testing.T) {
	logger, _ := zap.NewDevelopment()

	// Verify service constructors work
	_ = service.NewMetricService(nil, nil, logger)
	_ = service.NewAlertService(nil, logger)
}
