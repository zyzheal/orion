package main

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/monitor-svc-go/internal/middleware"
	"orion/monitor-svc-go/internal/service"
	"go.uber.org/zap"
	"github.com/gin-gonic/gin"
)

func TestHealthCheck(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "orion-monitor-svc-go"})
	})

	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, w.Code)
	}
}

func TestServiceInitialization(t *testing.T) {
	logger, _ := zap.NewDevelopment()
	_ = service.NewMetricService(nil, nil, logger)
	_ = service.NewAlertService(nil, logger)
}

func TestAuthMiddlewareReturnsHandler(t *testing.T) {
	// Auth should return a gin.HandlerFunc without panicking
	h := middleware.Auth(nil, "secret")
	if h == nil {
		t.Error("expected Auth to return a non-nil handler")
	}
}
