package middleware

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

var (
	logger *zap.Logger
)

func InitMiddleware(log *zap.Logger) {
	logger = log
}

// RequestID generates and injects a request ID into the context and headers.
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader("X-Request-Id")
		if requestID == "" {
			requestID = uuid.New().String()
		}
		c.Set("requestId", requestID)
		c.Header("X-Request-Id", requestID)
		c.Next()
	}
}

// StructuredLog logs each request with structured fields.
func StructuredLog() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		query := c.Request.URL.RawQuery

		c.Next()

		latency := time.Since(start)
		status := c.Writer.Status()

		logger.Info("request completed",
			zap.Int("status", status),
			zap.String("method", c.Request.Method),
			zap.String("path", path),
			zap.String("query", query),
			zap.Duration("latency", latency),
			zap.String("requestId", c.GetString("requestId")),
			zap.String("clientIp", c.ClientIP()),
		)
	}
}

// TenantID extracts and validates tenant_id from the JWT token (simulated via header for now).
func TenantID() gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID := c.GetHeader("X-Tenant-Id")
		if tenantID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "MISSING_TENANT",
				"message": "X-Tenant-Id header is required",
			})
			c.Abort()
			return
		}

		_, err := uuid.Parse(tenantID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "INVALID_TENANT",
				"message": "X-Tenant-Id must be a valid UUID",
			})
			c.Abort()
			return
		}

		c.Set("tenantId", tenantID)
		c.Next()
	}
}

// Auth validates the Authorization bearer token (simulated).
func Auth() gin.HandlerFunc {
	return func(c *gin.Context) {
		auth := c.GetHeader("Authorization")
		if auth == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "MISSING_AUTH",
				"message": "Authorization header is required",
			})
			c.Abort()
			return
		}

		if !strings.HasPrefix(auth, "Bearer ") {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "INVALID_AUTH",
				"message": "Authorization must be Bearer token",
			})
			c.Abort()
			return
		}

		token := strings.TrimPrefix(auth, "Bearer ")
		if len(token) < 10 {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "INVALID_AUTH",
				"message": "Invalid token",
			})
			c.Abort()
			return
		}

		c.Set("token", token)
		c.Next()
	}
}

// Recover recovers from panics and logs with structured fields.
func Recover() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if r := recover(); r != nil {
				logger.Error("panic recovered",
					zap.Any("error", r),
					zap.String("requestId", c.GetString("requestId")),
					zap.String("path", c.Request.URL.Path),
				)
				c.JSON(http.StatusInternalServerError, gin.H{
					"error":   "INTERNAL_ERROR",
					"message": "Internal server error",
				})
				c.Abort()
			}
		}()
		c.Next()
	}
}
