// Package middleware provides Orion-platform-specific Gin middleware.
package middleware

import (
	"context"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// defaultRequestTimeout is the default timeout for every HTTP request.
const defaultRequestTimeout = 30 * time.Second

// timeoutKey is the Gin context key used to store the timeout-wrapped context.
const timeoutKey = "request_timeout_ctx"

// TimeoutConfig holds configuration for the request timeout middleware.
type TimeoutConfig struct {
	// DefaultTimeout sets the per-request timeout. Zero means no timeout.
	DefaultTimeout time.Duration
}

// DefaultTimeoutConfig returns a TimeoutConfig with sensible defaults.
func DefaultTimeoutConfig() TimeoutConfig {
	return TimeoutConfig{
		DefaultTimeout: defaultRequestTimeout,
	}
}

// Timeout returns a Gin middleware that wraps the request context with a
// cancel-able timeout so that every downstream service/repository call carries
// a deadline. This replaces the common bug pattern where handlers call
// context.Background() and silently drop both tracing and timeout semantics.
//
// Usage (placed early in the middleware chain, before Tracing):
//
//	r := gin.New()
//	r.Use(middleware.Timeout(middleware.DefaultTimeoutConfig()))
//	...
//
// Handlers should use middleware.TimeoutContext(c) to obtain the timed context
// instead of calling context.Background() or c.Request.Context() directly.
func Timeout(cfg TimeoutConfig) gin.HandlerFunc {
	if cfg.DefaultTimeout <= 0 {
		// No timeout configured — pass through.
		return func(c *gin.Context) {
			c.Next()
		}
	}

	// If the request already carries a timeout (e.g. client closed), respect it.
	return func(c *gin.Context) {
		// Honor X-Request-Timeout header (seconds) for client-driven override.
		var timeout time.Duration = cfg.DefaultTimeout
		if raw := c.GetHeader("X-Request-Timeout"); raw != "" {
			if v, err := strconv.Atoi(raw); err == nil && v > 0 {
				timeout = time.Duration(v) * time.Second
			}
		}

		parent := c.Request.Context()
		ctx, cancel := context.WithTimeout(parent, timeout)
		defer cancel()

		// Store for downstream handlers via TimeoutContext().
		c.Set(timeoutKey, ctx)
		// Also update the request so c.Request.Context() reflects the timeout.
		c.Request = c.Request.WithContext(ctx)

		c.Next()
	}
}

// TimeoutContext returns the timeout-wrapped context from the Gin context, or
// falls back to c.Request.Context() if no timeout middleware is installed.
//
// Callers (handlers) should prefer this over context.Background() to ensure
// trace propagation and deadline-aware cancellation.
func TimeoutContext(c *gin.Context) context.Context {
	if v, ok := c.Get(timeoutKey); ok {
		if ctx, ok := v.(context.Context); ok {
			return ctx
		}
	}
	return c.Request.Context()
}
