// Package middleware provides shared Gin middleware for Orion Go services.
//
// Replaces per-service duplicated middleware (RequestID, StructuredLogger, CORS, Recovery, Metrics).
package middleware

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"time"

	"context"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.uber.org/zap"
)

// RequestID generates a unique request ID and sets it in the context and response header.
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Use existing header if present (gateway may set it)
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			b := make([]byte, 16)
			_, _ = rand.Read(b)
			requestID = hex.EncodeToString(b)
		}
		c.Set("request_id", requestID)
		c.Header("X-Request-ID", requestID)
		c.Next()
	}
}

// GetRequestID extracts the request ID from the gin context.
func GetRequestID(c *gin.Context) string {
	v, _ := c.Get("request_id")
	s, _ := v.(string)
	return s
}

// StructuredLogger returns middleware that logs requests using structured zap logging.
func StructuredLogger(logger *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()

		fields := []zap.Field{
			zap.String("method", c.Request.Method),
			zap.String("path", c.Request.URL.Path),
			zap.Int("status", c.Writer.Status()),
			zap.Duration("latency", time.Since(start)),
			zap.String("request_id", GetRequestID(c)),
			zap.String("client_ip", c.ClientIP()),
		}

		if c.Writer.Status() >= 500 {
			logger.Error("request", fields...)
		} else if c.Writer.Status() >= 400 {
			logger.Warn("request", fields...)
		} else {
			logger.Info("request", fields...)
		}
	}
}

// CORSConfig holds CORS configuration.
type CORSConfig struct {
	// AllowOrigins is a list of allowed origins. Default: ["*"].
	AllowOrigins []string
	// AllowMethods is a list of allowed HTTP methods.
	AllowMethods []string
	// AllowHeaders is a list of allowed headers.
	AllowHeaders []string
	// AllowCredentials indicates whether the request can include user credentials.
	AllowCredentials bool
	// MaxAge indicates how long (in seconds) the results of a preflight request can be cached.
	MaxAge int
}

// DefaultCORSConfig returns permissive CORS defaults.
func DefaultCORSConfig() CORSConfig {
	return CORSConfig{
		AllowOrigins: []string{"*"},
		AllowMethods: []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders: []string{"Authorization", "Content-Type", "X-Tenant-ID", "X-Request-ID"},
		MaxAge:       86400,
	}
}

// CORS returns middleware that handles Cross-Origin Resource Sharing.
func CORS(cfg CORSConfig) gin.HandlerFunc {
	originSet := make(map[string]bool, len(cfg.AllowOrigins))
	for _, o := range cfg.AllowOrigins {
		originSet[o] = true
	}
	allOrigins := originSet["*"]

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin == "" {
			c.Next()
			return
		}

		if allOrigins || originSet[origin] {
			if allOrigins {
				c.Header("Access-Control-Allow-Origin", "*")
			} else {
				c.Header("Access-Control-Allow-Origin", origin)
				c.Header("Vary", "Origin")
			}
		}

		c.Header("Access-Control-Allow-Methods", joinStrings(cfg.AllowMethods))
		c.Header("Access-Control-Allow-Headers", joinStrings(cfg.AllowHeaders))

		if cfg.AllowCredentials {
			c.Header("Access-Control-Allow-Credentials", "true")
		}
		if cfg.MaxAge > 0 {
			c.Header("Access-Control-Max-Age", itoa(cfg.MaxAge))
		}

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

// Recovery returns middleware that recovers from panics and logs the error.
func Recovery(logger *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if r := recover(); r != nil {
				logger.Error("panic recovered",
					zap.Any("error", r),
					zap.String("method", c.Request.Method),
					zap.String("path", c.Request.URL.Path),
					zap.String("request_id", GetRequestID(c)),
				)
				c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
					"code":    500,
					"message": "internal server error",
				})
			}
		}()
		c.Next()
	}
}

// MetricsHandler returns a gin.HandlerFunc that serves Prometheus metrics.
func MetricsHandler() gin.HandlerFunc {
	h := promhttp.Handler()
	return func(c *gin.Context) {
		h.ServeHTTP(c.Writer, c.Request)
	}
}

// HealthCheck returns a simple health check handler.
func HealthCheck(serviceName string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"service": serviceName,
		})
	}
}

// HealthConfig holds configuration for the dependency-aware health check.
type HealthCheckFn func(ctx context.Context) error

// DepHealthCheck returns a gin handler that checks multiple dependencies.
func DepHealthCheck(serviceName string, checks map[string]HealthCheckFn) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx := c.Request.Context()
		deps := make(map[string]string)
		healthy := true
		for name, fn := range checks {
			if err := fn(ctx); err != nil {
				deps[name] = "unhealthy"
				healthy = false
			} else {
				deps[name] = "healthy"
			}
		}
		status := "ok"
		if !healthy {
			status = "degraded"
		}
		c.JSON(http.StatusOK, gin.H{
			"status":  status,
			"service": serviceName,
			"deps":    deps,
		})
	}
}

// joinStrings joins a slice of strings with ", ".
func joinStrings(ss []string) string {
	if len(ss) == 0 {
		return ""
	}
	result := ss[0]
	for _, s := range ss[1:] {
		result += ", " + s
	}
	return result
}

// itoa converts an int to a string without importing strconv.
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	buf := make([]byte, 0, 10)
	for n > 0 {
		buf = append([]byte{byte('0' + n%10)}, buf...)
		n /= 10
	}
	return string(buf)
}
