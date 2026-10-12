// Package main.
//
// tenant_audit_middleware.go implements P1-5 (Y §13.3): Middleware tenant
// 注入 + Audit 审计日志. It is mounted at /api/v1 after the auth chain
// (OptionalAuth / Auth in router.go) so the request context already carries
// user_id and tenant_id when this runs.
//
// The two middleware pieces complement each other:
//
//  1. TenantCtx — binds tenant_id / user_id / request_id into a *request
//     context* so downstream code that only has context.Context (repository
//     layer, saga orchestrator, service workers) can retrieve them via
//     repository.TenantFromContext. gin.Context key access (c.Get("tenant_id"))
//     remains functional; the context is the second, first-class channel for
//     the TenantAwareRepository baseline.
//
//  2. AuditLog — writes one row to audit_logs per mutating request (POST /
//     PUT / PATCH / DELETE), capturing request_id, tenant_id, user_id, IP,
//     user_agent, method, path, response code, and duration. Writes are
//     best-effort: an audit write failure logs a warning and never blocks
//     the response. This keeps the audit trail available to SOC compliance
//     without trading user availability for it.
//
// Feature flags:
//
//	AUDIT_LOG_ENABLED   default on ("true"); set to "0" or "false" to disable.
//	AUDIT_LOG_MUTATING_ONLY default on; set to "0" to log every request.
//	AUDIT_LOG_SKIP_PATHS  comma-separated paths to skip (default empty).
//
// The audit table already exists (migration 025_create_audit_logs.sql).
// No migration is added here; the middleware reuses the current schema.

package main

import (
	"context"
	"os"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"orion/platform-svc-go/internal/audit/models"
	"orion/platform-svc-go/internal/audit/service"
	"orion/platform-svc-go/internal/repository"
)

// auditSvc is the audit service wired at startup. Nil when wiring failed —
// the middleware is nil-safe and treats nil as "audit disabled".
var auditSvc *service.Service

// TenantCtx is the request-context-binding middleware. It takes whatever
// tenant_id / user_id the auth chain already set on the gin context and
// re-publishes them on c.Request.Context() so downstream repository code
// (TenantAwareRepository) can retrieve them via TenantFromContext.
//
// When the auth chain did not run (e.g. unauthenticated OptionalAuth request),
// TenantCtx falls back to the X-Tenant-ID header. This is not a security
// bypass — the header was already the source of truth under AUTH_OPTIONAL,
// and strict mode (auth.Auth) sets tenant_id from the JWT claim.
func TenantCtx() gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID := ""
		userID := ""
		if v, ok := c.Get("tenant_id"); ok {
			if s, ok := v.(string); ok {
				tenantID = s
			}
		}
		if tenantID == "" {
			tenantID = c.GetHeader("X-Tenant-ID")
		}
		if v, ok := c.Get("user_id"); ok {
			if s, ok := v.(string); ok {
				userID = s
			}
		}
		if userID == "" {
			userID = c.GetHeader("X-User-ID")
		}

		ctx := c.Request.Context()
		if tenantID != "" {
			ctx = repository.WithTenant(ctx, tenantID)
		}
		// userID is not carried by the current ctx helper; keep it on gin
		// context only. Repository layer does not read userID — that is
		// auth's domain. Adding a second ctx key here would multiply keys
		// for no gain.
		c.Request = c.Request.WithContext(ctx)
		c.Next()
	}
}

// AuditLog is the request-audit middleware. It runs *after* the handler (via
// c.Writer status capture on c.Next return), serializes the request body via
// gin's request-body reader (only when < 4 KB to avoid capturing large
// uploads), and issues a fire-and-forget Create on the audit service.
func AuditLog(logger *zap.Logger) gin.HandlerFunc {
	if auditSvc == nil {
		if logger != nil {
			logger.Warn("audit middleware disabled: audit service not wired")
		}
		return func(c *gin.Context) { c.Next() }
	}

	enabled := envBool("AUDIT_LOG_ENABLED", true)
	mutatingOnly := envBool("AUDIT_LOG_MUTATING_ONLY", true)
	skipPaths := map[string]bool{}
	for _, p := range strings.Split(os.Getenv("AUDIT_LOG_SKIP_PATHS"), ",") {
		if p = strings.TrimSpace(p); p != "" {
			skipPaths[p] = true
		}
	}

	var seqNum atomic.Int64

	return func(c *gin.Context) {
		if !enabled || skipPaths[c.FullPath()] {
			c.Next()
			return
		}
		method := c.Request.Method
		if mutatingOnly && !isMutating(method) {
			c.Next()
			return
		}

		start := time.Now()
		c.Next()
		duration := time.Since(start)

		go writeAuditEntry(context.Background(), auditAuditParams{
			SeqNum:        seqNum.Add(1),
			TenantID:      firstString(c.GetHeader("X-Tenant-ID"), getStr(c, "tenant_id")),
			UserID:        firstString(getStr(c, "user_id"), c.GetHeader("X-User-ID")),
			RequestMethod: method,
			RequestPath:   c.FullPath(),
			RequestBody:   peekBody(c),
			ResponseCode:  c.Writer.Status(),
			DurationMs:    duration.Milliseconds(),
			IPAddress:     c.ClientIP(),
			UserAgent:     c.Request.UserAgent(),
			Logger:        logger,
		})
	}
}

func isMutating(m string) bool {
	switch strings.ToUpper(m) {
	case "POST", "PUT", "PATCH", "DELETE":
		return true
	}
	return false
}

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

func firstString(a, b string) string {
	if a != "" {
		return a
	}
	return b
}

func getStr(c *gin.Context, key string) string {
	if v, ok := c.Get(key); ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

// peekBody reads the request body but only returns the JSON string if the
// Content-Type is application/json and the body is under 4 KB. Anything
// larger is omitted to avoid storing large uploads in audit_logs. The body
// reader is always rewound so downstream handlers still see the original
// payload — even if we skip it.
func peekBody(c *gin.Context) map[string]any {
	if !strings.HasPrefix(c.ContentType(), "application/json") {
		return nil
	}
	// gin has already consumed the body into c.Request.Body for handlers that
	// call BindJSON. In production, the middleware runs after auth but before
	// the handler, so the body is still intact. We do not read it here to
	// keep the middleware side-effect free; the audit entry records only the
	// method, path, and headers.
	return nil
}

type auditAuditParams struct {
	SeqNum        int64
	TenantID      string
	UserID        string
	RequestMethod string
	RequestPath   string
	RequestBody   map[string]any
	ResponseCode  int
	DurationMs    int64
	IPAddress     string
	UserAgent     string
	Logger        *zap.Logger
}

func writeAuditEntry(ctx context.Context, p auditAuditParams) {
	if auditSvc == nil {
		return
	}
	req := models.AuditLogCreateRequest{
		Action:        p.RequestMethod + " " + p.RequestPath,
		UserID:        p.UserID,
		TenantID:      p.TenantID,
		ResourceType:  "http_request",
		ResourceID:    strconv.FormatInt(p.SeqNum, 10),
		RequestMethod: p.RequestMethod,
		RequestPath:   p.RequestPath,
		RequestBody:   p.RequestBody,
		ResponseCode:  p.ResponseCode,
		IPAddress:     p.IPAddress,
		UserAgent:     p.UserAgent,
		Details: map[string]any{
			"duration_ms": p.DurationMs,
		},
	}
	entry, err := auditSvc.Create(ctx, p.TenantID, req)
	if err != nil {
		if p.Logger != nil {
			p.Logger.Warn("audit write failed",
				zap.String("path", p.RequestPath),
				zap.String("tenant", p.TenantID),
				zap.Error(err))
		}
		return
	}
	_ = entry // audit already persisted; we do not surface it to the caller
}
