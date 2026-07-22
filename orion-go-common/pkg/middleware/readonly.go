// Package middleware provides shared Gin middleware for Orion Go services.
//
// Replaces per-service duplicated middleware (RequestID, StructuredLogger, CORS, Recovery, Metrics).

package middleware

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

// writeMethods is the set of HTTP methods considered "write" operations.
var writeMethods = map[string]bool{
	"POST":    true,
	"PUT":     true,
	"PATCH":   true,
	"DELETE":  true,
}

// defaultWhitelistPaths are paths that bypass the read-only guard even when enabled.
var defaultWhitelistPaths = []string{
	"/healthz",
	"/health",
	"/metrics",
}

// readOnlyOption is a functional option for WriteAuthorityGuard configuration.
type readOnlyOption func(*readOnlyConfig)

// readOnlyConfig holds configuration for the read-only guard.
type readOnlyConfig struct {
	// whitelistPaths are paths that bypass the read-only guard.
	// Defaults to /healthz, /health, /metrics.
	whitelistPaths []string
	// enabled overrides the MIGRATION_READONLY environment variable.
	// If true, forces read-only mode regardless of env; if false, disabled.
	// nil (zero value) means the env variable is consulted.
	forceEnabled *bool
}

// WithReadOnlyPaths sets custom paths that bypass the read-only guard.
// Replace the default whitelist entirely.
func WithReadOnlyPaths(paths []string) readOnlyOption {
	return func(c *readOnlyConfig) {
		c.whitelistPaths = paths
	}
}

// WithReadOnlyForceEnabled forces the guard on or off, ignoring the environment variable.
func WithReadOnlyForceEnabled(enabled bool) readOnlyOption {
	return func(c *readOnlyConfig) {
		c.forceEnabled = &enabled
	}
}

// WriteAuthorityGuard returns middleware that blocks write HTTP methods (POST/PUT/PATCH/DELETE)
// when the service is in read-only migration mode.
//
// Read-only mode is controlled by the MIGRATION_READONLY environment variable.
// When set to "true" (case-insensitive), all non-GET requests return HTTP 405
// Method Not Allowed with a JSON error body.
//
// Whitelisted paths (/healthz, /health, /metrics by default) are always allowed.
// Options:
//   - WithReadOnlyPaths(paths) : replace the default whitelist.
//   - WithReadOnlyForceEnabled(bool) : override the env variable.
//
// Example:
//
//	r := gin.New()
//	r.Use(middleware.WriteAuthorityGuard())
//	// or with custom paths:
//	r.Use(middleware.WriteAuthorityGuard(
//	    middleware.WithReadOnlyPaths([]string{"/healthz", "/status", "/metrics"}),
//	))
func WriteAuthorityGuard(opts ...readOnlyOption) gin.HandlerFunc {
	cfg := &readOnlyConfig{
		whitelistPaths: defaultWhitelistPaths,
	}
	for _, opt := range opts {
		opt(cfg)
	}

	enabled := isReadOnlyEnabled(cfg.forceEnabled)

	return func(c *gin.Context) {
		if !enabled {
			c.Next()
			return
		}

		method := c.Request.Method

		// Only intercept write methods; GET/HEAD/OPTIONS pass through.
		if !writeMethods[method] {
			c.Next()
			return
		}

		// Check if the request path is whitelisted.
		if isWhitelisted(c.Request.URL.Path, cfg.whitelistPaths) {
			c.Next()
			return
		}

		// Reject the write operation.
		c.Header("Allow", "GET, HEAD, OPTIONS")
		c.JSON(http.StatusMethodNotAllowed, gin.H{
			"success": false,
			"code":    "METHOD_NOT_ALLOWED",
			"message": "服务处于只读模式，写入操作被拒绝",
		})
		c.Abort()
	}
}

// isReadOnlyEnabled checks the MIGRATION_READONLY environment variable.
// If force is non-nil, its value is returned instead of consulting the env.
func isReadOnlyEnabled(force *bool) bool {
	if force != nil {
		return *force
	}
	v := os.Getenv("MIGRATION_READONLY")
	return strings.EqualFold(strings.TrimSpace(v), "true")
}

// isWhitelisted checks whether a path matches any of the allowed prefixes.
// Exact match or prefix match (with trailing slash) is accepted.
func isWhitelisted(path string, whitelist []string) bool {
	for _, allowed := range whitelist {
		if path == allowed || strings.HasPrefix(path, allowed+"/") {
			return true
		}
	}
	return false
}
