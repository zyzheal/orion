// Package middleware — audit.go implements P1-6 (API Gateway 网关层统一,
// ADR-011 §5 补充): a gateway-side audit trail middleware.
//
// Design notes:
//
//  1. Purpose. The platform service already writes a per-mutating-request
//     row to audit_logs (see cmd/server/tenant_audit_middleware.go in
//     platform-svc-go). The gateway is the *only* entry point for external
//     traffic, so adding a lightweight gateway-side record closes the
//     observability loop: even when the upstream service drops the audit
//     row (crash, timeout, network drop), the gateway still has a
//     timestamped record of what request was proxied to which upstream.
//
//  2. Fire-and-forget. This middleware never writes to a DB. It emits one
//     structured log line per request after the upstream responds. Log
//     sinks (Loki, Elasticsearch, OTLP) can pick it up. This avoids
//     coupling the gateway to a shared audit schema that must outlive
//     the platform service deployment.
//
//  3. Fields captured: request_id, tenant_id, user_id, method, path
//     (the resolved /api/<prefix>/<...> form), upstream prefix, response
//     status, duration_ms, client IP, user agent. These mirror the
//     platform AuditLog middleware's column set so joins are trivial
//     for SOC analysts.
//
//  4. Skip paths. Health checks, metrics, and CSP reports are filtered
//     out — they are high-frequency machine traffic that would drown out
//     the audit trail without adding investigative value. The skip list
//     is env-configurable via GATEWAY_AUDIT_SKIP_PATHS for flexibility.
//
//  5. Feature flags. GATEWAY_AUDIT_ENABLED (default on),
//     GATEWAY_AUDIT_MUTATING_ONLY (default on — GET is skipped by default
//     to keep the audit trail focused on mutations),
//     GATEWAY_AUDIT_SKIP_PATHS (comma-separated).
//
//  6. Fail-safe. If the logger is nil the middleware is a no-op
//     (pass-through). Structured logging errors are always fail-open —
//     a logging bug never breaks request routing.
package middleware

import (
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// auditSkipPathsDefault lists paths that should never appear in the
// gateway audit trail. These are machine-traffic endpoints whose volume
// would dwarf the actual user-generated audit signal.
var auditSkipPathsDefault = map[string]bool{
	"/health":          true,
	"/healthz":         true,
	"/readyz":          true,
	"/metrics":         true,
	"/version":         true,
	"/api/v1/csp-report": true,
	"/ws":              true, // websocket handshake — logs on open, not per-message
}

// ProxyAudit returns a gin middleware that emits one structured audit
// log per proxied request after the handler completes. The middleware
// captures tenant_id and user_id from the gin context (populated by
// TenantPropagation / JWTAuth earlier in the chain) and includes them in
// the log so SOC can join gateway audit records to the platform's
// audit_logs rows via (request_id, tenant_id).
//
// Behavior:
//
//   - AUDIT_LOG_ENABLED semantics via GATEWAY_AUDIT_ENABLED (default on).
//   - Mutating-only by default (POST/PUT/PATCH/DELETE). GET/HEAD/OPTIONS
//     are skipped unless GATEWAY_AUDIT_MUTATING_ONLY=0.
//   - Skip paths are case-sensitive; GATEWAY_AUDIT_SKIP_PATHS lets ops
//     add more at runtime without rebuilding.
//   - Duration is measured from middleware entry to handler return.
func ProxyAudit(logger *zap.Logger) gin.HandlerFunc {
	if logger == nil {
		return func(c *gin.Context) { c.Next() }
	}

	enabled := envBool("GATEWAY_AUDIT_ENABLED", true)
	mutatingOnly := envBool("GATEWAY_AUDIT_MUTATING_ONLY", true)

	// Merge default skip list with env override.
	skip := make(map[string]bool, len(auditSkipPathsDefault))
	for p := range auditSkipPathsDefault {
		skip[p] = true
	}
	if extra := strings.TrimSpace(os.Getenv("GATEWAY_AUDIT_SKIP_PATHS")); extra != "" {
		for _, p := range strings.Split(extra, ",") {
			if p = strings.TrimSpace(p); p != "" {
				skip[p] = true
			}
		}
	}

	return func(c *gin.Context) {
		if !enabled {
			c.Next()
			return
		}
		if skip[c.Request.URL.Path] {
			c.Next()
			return
		}
		method := c.Request.Method
		if mutatingOnly && !isMutatingMethod(method) {
			c.Next()
			return
		}

		start := time.Now()
		c.Next()
		duration := time.Since(start)

		// Best-effort extraction. Header fallback covers requests that
		// bypassed JWTAuth (e.g. public paths that still reach a proxy).
		tenantID := c.GetString("tenant_id")
		if tenantID == "" {
			tenantID = c.GetHeader("X-Tenant-ID")
		}
		userID := c.GetString("user_id")
		if userID == "" {
			userID = c.GetHeader("X-User-ID")
		}

		logger.Info("gateway_audit",
			zap.String("request_id", c.GetString("request_id")),
			zap.String("tenant_id", tenantID),
			zap.String("user_id", userID),
			zap.String("method", method),
			zap.String("path", c.Request.URL.Path),
			zap.Int("status", c.Writer.Status()),
			zap.Int64("duration_ms", duration.Milliseconds()),
			zap.String("client_ip", c.ClientIP()),
			zap.String("user_agent", c.Request.UserAgent()),
		)
	}
}

// isMutatingMethod classifies HTTP methods the same way platform
// service's AuditLog middleware does. Kept private so callers can only
// use ProxyAudit, not the classifier.
func isMutatingMethod(m string) bool {
	switch strings.ToUpper(m) {
	case "POST", "PUT", "PATCH", "DELETE":
		return true
	}
	return false
}

// envBool parses a boolean env var with sensible defaults. Same
// semantics as platform service's envBool helper — kept local because
// gateway does not import platform code.
func envBool(key string, def bool) bool {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	if v == "1" || strings.EqualFold(v, "true") {
		return true
	}
	if v == "0" || strings.EqualFold(v, "false") {
		return false
	}
	return def
}
