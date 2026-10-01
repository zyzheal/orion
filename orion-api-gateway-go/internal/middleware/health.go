package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// HealthCheck is a function that checks the health of a dependency.
type HealthCheck func() (status string, message string)

// HealthMiddleware provides health check endpoints.
type HealthMiddleware struct {
	mu     sync.RWMutex
	checks map[string]HealthCheck
}

// NewHealthMiddleware creates a health middleware.
func NewHealthMiddleware() *HealthMiddleware {
	hm := &HealthMiddleware{
		checks: make(map[string]HealthCheck),
	}
	hm.RegisterCheck("self", func() (string, string) {
		return "up", ""
	})
	return hm
}

// RegisterCheck registers a health check.
func (hm *HealthMiddleware) RegisterCheck(name string, checker HealthCheck) {
	hm.mu.Lock()
	defer hm.mu.Unlock()
	hm.checks[name] = checker
}

// Handler returns the health check Gin handler.
func (hm *HealthMiddleware) Handler() gin.HandlerFunc {
	return func(c *gin.Context) {
		checks := map[string]map[string]string{}
		overall := "healthy"
		upCount := 0

		hm.mu.RLock()
		for name, checker := range hm.checks {
			status, msg := checker()
			checks[name] = map[string]string{"status": status, "message": msg}
			if status == "down" {
				overall = "degraded"
			} else {
				upCount++
			}
		}
		hm.mu.RUnlock()

		if upCount == 0 {
			overall = "unhealthy"
		}

		httpStatus := http.StatusOK
		if overall == "unhealthy" {
			httpStatus = http.StatusServiceUnavailable
		}

		c.JSON(httpStatus, gin.H{
			"status":    overall,
			"timestamp": time.Now().UTC().Format(time.RFC3339),
			"version":   "1.0.0",
			"checks":    checks,
		})
	}
}

// ReadyHandler returns a simple readiness check.
func ReadyHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "ready",
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
	}
}

// VersionHandler returns version information.
func VersionHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"version":   "1.0.0",
			"name":      "orion-api-gateway",
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
	}
}
