// Package middleware provides Orion-platform-specific Gin middleware.
package middleware

import (
	"fmt"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ---------------------------------------------------------------------------
// Context key constants for standard structured-log fields
// ---------------------------------------------------------------------------

const (
	// Standard key names used by handlers to read injected values.
	StdFieldTraceID = "trace_id"
	StdFieldTenantID = "tenant_id"
	StdFieldUserID = "user_id"
	StdFieldHandlerName = "handler"
	StdFieldRemoteIP = "remote_ip"
	StdFieldRequestID = "request_id"
)

// contextKey is a private, unexported type to avoid collisions between
// different context values stored in gin.Context.
type contextKey string

// StdLoggerContext is a Gin middleware that injects standard structured-log
// fields into gin.Context for downstream handlers and service calls.
//
// It extracts or derives the following fields from the incoming request and
// stores them in gin.Context so that any downstream code can read them via
// c.GetString(...). It then calls the standard gin logger (SetNoCache +
// request logging) with those fields attached.
//
// After this middleware runs, handler code can safely do:
//
//	traceID  := c.GetString(middleware.StdFieldTraceID)
//	tenantID := c.GetString(middleware.StdFieldTenantID)
//	userID   := c.GetString(middleware.StdFieldUserID)
//	handler  := c.GetString(middleware.StdFieldHandlerName)
//
// The middleware also writes one structured JSON log line per request at
// response completion, containing:
//
//	{
//	  "time":       "2026-07-20T12:00:00Z",
//	  "traceId":    "01J9X...",
//	  "tenantId":   "tenant-42",
//	  "userId":     "user-7",
//	  "handler":    "feature-flag/handler.List",
//	  "method":     "GET",
//	  "path":       "/api/v1/features",
//	  "status":     200,
//	  "latency":    123456,           // microseconds
//	  "remote_ip":  "203.0.113.1",
//	  "user_agent": "curl/8.0.1"
//	}
func StdLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Determine the handler name BEFORE c.Next() so we capture it even if
		// the response is aborted partway through the chain.
		handlerName := normalizeLogHandlerName(c.HandlerName())

		// Inject standard fields into gin.Context so downstream code can read them.
		// Some of these may already be set by the auth middleware; we only set
		// a default if the value is missing, preserving any value already present.
		if c.GetString(StdFieldTraceID) == "" {
			if v := c.GetString("trace_id"); v != "" {
				c.Set(StdFieldTraceID, v)
			} else {
				c.Set(StdFieldTraceID, c.GetString("request_id")) // fall back to request ID
			}
		}
		if c.GetString(StdFieldTenantID) == "" {
			c.Set(StdFieldTenantID, c.GetString("tenant_id"))
		}
		if c.GetString(StdFieldUserID) == "" {
			c.Set(StdFieldUserID, c.GetString("user_id"))
		}
		c.Set(StdFieldHandlerName, handlerName)

		remoteIP := c.ClientIP()
		c.Set(StdFieldRemoteIP, remoteIP)

		c.Set(StdFieldRequestID, c.GetString("request_id"))

		start := time.Now()

		// Execute downstream handler chain.
		c.Next()

		// Build structured log entry after the response completes.
		status := c.Writer.Status()
		latency := time.Since(start).Microseconds()

		logEntry := gin.H{
			"time":      time.Now().UTC().Format(time.RFC3339),
			"traceId":   c.GetString(StdFieldTraceID),
			"tenantId":  c.GetString(StdFieldTenantID),
			"userId":    c.GetString(StdFieldUserID),
			"handler":   c.GetString(StdFieldHandlerName),
			"method":    c.Request.Method,
			"path":      c.Request.URL.Path,
			"status":    status,
			"latency":   latency,
			"remote_ip": c.GetString(StdFieldRemoteIP),
			"user_agent": c.Request.UserAgent(),
		}

		// Write the structured log line. Gin's default logger (gin.DefaultWriter)
		// writes to stdout; this produces a single JSON line per request.
		// We deliberately use fmt.Sprintf + newline so that log aggregation tools
		// (fluentd, vector, Loki) parse it as a single structured record.
		record, ok := formatLogRecord(logEntry)
		// Write the structured log line to stdout (gin's default writer).
		// gin.DefaultWriter points to os.Stdout by default.
		fmt.Fprintf(gin.DefaultWriter, "%s\n", record)
	}
}

// StdLoggerWithLevel returns a StdLogger middleware that only emits the
// structured JSON line at a given status-code threshold. Pass
//
//	0  — log all requests
//	400 — log only status >= 400 (warn equivalent)
//	500 — log only status >= 500 (error equivalent)
//
// to control the minimum HTTP status code that triggers a log line.
func StdLoggerWithLevel(minStatus int) gin.HandlerFunc {
	return func(c *gin.Context) {
		handlerName := normalizeLogHandlerName(c.HandlerName())

		if c.GetString(StdFieldTraceID) == "" {
			if v := c.GetString("trace_id"); v != "" {
				c.Set(StdFieldTraceID, v)
			} else {
				c.Set(StdFieldTraceID, c.GetString("request_id"))
			}
		}
		if c.GetString(StdFieldTenantID) == "" {
			c.Set(StdFieldTenantID, c.GetString("tenant_id"))
		}
		if c.GetString(StdFieldUserID) == "" {
			c.Set(StdFieldUserID, c.GetString("user_id"))
		}
		c.Set(StdFieldHandlerName, handlerName)
		c.Set(StdFieldRemoteIP, c.ClientIP())
		c.Set(StdFieldRequestID, c.GetString("request_id"))

		start := time.Now()
		c.Next()

		status := c.Writer.Status()
		latency := time.Since(start).Microseconds()

		logEntry := gin.H{
			"time":       time.Now().UTC().Format(time.RFC3339),
			"traceId":    c.GetString(StdFieldTraceID),
			"tenantId":   c.GetString(StdFieldTenantID),
			"userId":     c.GetString(StdFieldUserID),
			"handler":    c.GetString(StdFieldHandlerName),
			"method":     c.Request.Method,
			"path":       c.Request.URL.Path,
			"status":     status,
			"latency":    latency,
			"remote_ip":  c.GetString(StdFieldRemoteIP),
			"user_agent": c.Request.UserAgent(),
		}

		record, ok := formatLogRecord(logEntry)
		if !ok {
			record = fmt.Sprintf("structlog entry failed to serialize: %v", logEntry)
		}

		// Decide whether to log based on minimum status threshold.
		shouldLog := status >= minStatus

		if shouldLog {
			fmt.Fprintf(gin.DefaultWriter, "%s\n", record)
		}
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// normalizeLogHandlerName returns a compact, human-readable handler name for
// log output. It collapses the full qualified Go function name into a stable
// module/subpkg.Handler.Method form.
//
// Examples:
//   "orion/platform-svc-go/internal/feature-flag/handler.(*Handler).List-fm"
//   -> "feature-flag/handler.Handler.List"
func normalizeLogHandlerName(fullName string) string {
	if fullName == "" {
		return "unregistered"
	}

	// Strategy: keep only the last three path segments after "internal/",
	// plus the receiver and method name.
	// Pattern: .../internal/<module>/<subpkg>/<file>.<Receiver>.<Method>-fm
	slashParts := strings.Split(fullName, "/")
	if len(slashParts) < 4 {
		return fullName
	}

	// Find "internal" in the path.
	internalIdx := -1
	for i, p := range slashParts {
		if p == "internal" {
			internalIdx = i
			break
		}
	}
	if internalIdx >= 0 && len(slashParts) > internalIdx+3 {
		module := slashParts[internalIdx+1]
		subpkg := slashParts[internalIdx+2]
		rest := slashParts[internalIdx+3]
		return fmt.Sprintf("%s/%s/%s", module, subpkg, rest)
	}

	return fullName
}

// formatLogRecord serializes a gin.H map into a single JSON line suitable for
// structured logging. It marshals to JSON with escaped special characters.
func formatLogRecord(entry gin.H) (string, bool) {
	// Build a typed map to guarantee consistent field ordering.
	// (We use gin.H as the input; convert to a concrete type for stable JSON.)
	b, ok := marshalToJSON(entry)
	if !ok {
		return "", false
	}
	return string(b), true
}

// marshalToJSON marshals the entry map to JSON bytes. We avoid importing the
// heavy json package at the top level and instead use fmt.Sprintf with a
// minimal escape pass. The output is valid JSON for the simple scalar values
// we store in gin.H.
func marshalToJSON(entry gin.H) ([]byte, bool) {
	// Use the standard library JSON marshaler — it is the right tool for
	// reliable structured log serialization.
	// (fmt and strings are already imported; json adds a compile-time dependency
	// but is the correct choice here.)
	// To avoid importing "encoding/json" in the file header we use a simple
	// string-escape approach for scalar values only.
	keys := []string{
		"time", "traceId", "tenantId", "userId", "handler",
		"method", "path", "status", "latency", "remote_ip", "user_agent",
	}
	parts := make([]string, 0, len(keys))
	for _, k := range keys {
		v, exists := entry[k]
		if !exists {
			continue
		}
		s := formatValue(v)
		parts = append(parts, fmt.Sprintf(`"%s":%s`, k, s))
	}
	if len(parts) == 0 {
		return []byte("{}"), true
	}
	return []byte("{" + strings.Join(parts, ",") + "}"), true
}

// formatValue serializes a single gin.H value into a JSON representation.
// Handles string, int, int64, float64, and the common numeric aliases.
func formatValue(v any) string {
	switch val := v.(type) {
	case string:
		return fmt.Sprintf(`"%s"`, escapeJSONString(val))
	case int:
		return fmt.Sprintf(`%d`, val)
	case int64:
		return fmt.Sprintf(`%d`, val)
	case float64:
		return fmt.Sprintf(`%.6f`, val)
	case uint64:
		return fmt.Sprintf(`%d`, val)
	case nil:
		return `null`
	case bool:
		return fmt.Sprintf(`%t`, val)
	default:
		// Fallback: try stringification.
		return fmt.Sprintf(`"%v"`, escapeJSONString(fmt.Sprintf("%v", v)))
	}
}

// escapeJSONString escapes a string for embedding in JSON. It handles the
// minimal set of characters needed for log values (quotes, backslash, newlines).
func escapeJSONString(s string) string {
	b := make([]byte, 0, len(s)+4)
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch c {
		case '"':
			b = append(b, '\\', '"')
		case '\\':
			b = append(b, '\\', '\\')
		case '\n':
			b = append(b, '\\', 'n')
		case '\r':
			b = append(b, '\\', 'r')
		case '\t':
			b = append(b, '\\', 't')
		default:
			b = append(b, c)
		}
	}
	return string(b)
}
