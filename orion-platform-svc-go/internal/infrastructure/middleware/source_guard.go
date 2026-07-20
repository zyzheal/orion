// Package middleware provides the SourceGuard middleware for dual-write conflict
// prevention between the TS monolith (source='ts') and the Go microservice
// (source='go').
//
// Overview
// --------
// Two services share the same PostgreSQL tables. Without coordination, one can
// silently overwrite the other's changes. SourceGuard solves this at two levels:
//
//   1. Source tagging (SetSource) — every INSERT/UPDATE from the Go service
//      carries `_source='go'`, so the database always records which service
//      last touched a row.
//
//   2. Conflict detection (BlockConflicts) — on UPDATE/DELETE the middleware
//      inspects the existing `_source` value. If the row was last written by
//      the TS service ('ts'), a conflict is detected.
//
//   3. Read-only mode — when SOURCE_GUARD_MODE=readonly, all write HTTP
//      methods (POST/PUT/PATCH/DELETE) are rejected except for a set of
//      health/metrics paths. This is useful during the TS-to-Go cutover
//      window when the Go service must read but never write.

package middleware

import (
	"net/http"
	"strings"

	"orion/go-common/pkg/errors"
	"github.com/gin-gonic/gin"
)

// Source represents the service that last wrote a row.
const (
	SourceTS string = "ts" // TS monolith (default for legacy rows)
	SourceGO string = "go" // Go microservice
)

// SourceGuard groups the dual-write prevention middleware together.
type SourceGuard struct {
	mode string
}

// NewSourceGuard creates a SourceGuard using the mode from SOURCE_GUARD_MODE
// (defaults to ModeReadWrite).
func NewSourceGuard() *SourceGuard {
	return &SourceGuard{mode: Mode()}
}

// NewSourceGuardWithMode creates a SourceGuard with an explicit mode.
func NewSourceGuardWithMode(mode string) *SourceGuard {
	if mode != ModeReadWrite && mode != ModeReadOnly {
		mode = ModeReadWrite
	}
	return &SourceGuard{mode: mode}
}

// IsReadOnly returns true when the guard is in read-only mode.
func (g *SourceGuard) IsReadOnly() bool {
	return g.mode == ModeReadOnly
}

// SetSource returns a Gin middleware that tags every write request with the
// current service source. It sets:
//   - The X-Source header to "go" (used by callers of the DB layer)
//   - The source value in gin context under the "source" key
//
// This is a no-op for read-only HTTP methods (GET/HEAD/OPTIONS) because no
// write occurs. The actual `_source` column injection happens in the
// repository layer (see source_tag.go).
//
// Example:
//
//	r.Use(SourceGuard.SetSource())
func (g *SourceGuard) SetSource() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set("source", SourceGO)
		c.Header("X-Source", SourceGO)
		c.Next()
	}
}

// BlockConflicts returns a Gin middleware that rejects write operations from
// the Go service when the row was last modified by the TS monolith.
//
// Behavior differs by mode:
//
//   - readwrite mode: Inspects the "_source" context key set by the service
//     layer after a SELECT-before-UPDATE. If the existing row's source is
//     SourceTS and the caller did not explicitly allow the conflict (see
//     WithConflictAllowed), the request is aborted with HTTP 409.
//
//   - readonly mode: Rejects ALL write HTTP methods immediately, before any
//     business logic runs, except for whitelisted health/metrics paths.
//
// Conflict detection at the HTTP layer works like this:
//  1. The handler/service reads the current row from the DB.
//  2. It checks the existing `_source` column.
//  3. If `_source == 'ts'` and conflict is not explicitly allowed,
//     the handler sets c.Set("_source_conflict", true).
//  4. This middleware inspects that key and aborts with 409.
//
// Example:
//
//	r.Use(SourceGuard.BlockConflicts())
func (g *SourceGuard) BlockConflicts() gin.HandlerFunc {
	whitelist := newWriteWhitelist()

	return func(c *gin.Context) {
		// --- Read-only mode: block all writes immediately ---
		if g.IsReadOnly() {
			if isWriteMethod(c.Request.Method) && !whitelist.matches(c.Request.URL.Path) {
				g.rejectReadOnly(c)
				c.Abort()
				return
			}
			c.Next()
			return
		}

		// --- Read-write mode: check for conflict flagged by service layer ---
		if conflict, ok := c.Get("_source_conflict"); ok {
			if conflict.(bool) {
				g.rejectConflict(c)
				c.Abort()
				return
			}
		}

		c.Next()
	}
}

// rejectReadOnly sends a standard 405 response for read-only mode.
func (g *SourceGuard) rejectReadOnly(c *gin.Context) {
	c.Header("Allow", "GET, HEAD, OPTIONS")
	errors.WriteError(c, errors.ErrForbidden, "服务处于只读模式，写入操作被拒绝", http.StatusMethodNotAllowed)
}

// rejectConflict sends a standard 409 response for TS/Go write conflict.
func (g *SourceGuard) rejectConflict(c *gin.Context) {
	errors.WriteError(c, errors.ErrConflict, "数据冲突：该行最近由 TS 服务修改，Go 服务拒绝覆盖", http.StatusConflict)
}

// SetConflict marks a context as having detected a source conflict.
// Call this from the service/handler layer when a SELECT-before-UPDATE
// reveals `_source == 'ts'` on the row being modified.
func SetConflict(c *gin.Context) {
	c.Set("_source_conflict", true)
}

// AllowConflict overrides a conflict flag. Call this when the business logic
// has validated that the overwrite is intentional (e.g., the user provided
// a force flag).
func AllowConflict(c *gin.Context) {
	c.Set("_source_conflict", false)
}

// GetSource returns the source value from gin context (set by SetSource).
func GetSource(c *gin.Context) string {
	v, _ := c.Get("source")
	s, _ := v.(string)
	if s == "" {
		return SourceTS // default to ts for legacy safety
	}
	return s
}

// hasConflict returns true if the context carries an unresolved conflict flag.
func hasConflict(c *gin.Context) bool {
	v, ok := c.Get("_source_conflict")
	if !ok {
		return false
	}
	b, ok := v.(bool)
	return ok && b
}

// --- write method / whitelist helpers ---

func isWriteMethod(method string) bool {
	switch method {
	case "POST", "PUT", "PATCH", "DELETE":
		return true
	}
	return false
}

type writeWhitelist struct {
	paths []string
}

func newWriteWhitelist() *writeWhitelist {
	return &writeWhitelist{
		paths: []string{
			"/healthz",
			"/health",
			"/metrics",
		},
	}
}

func (w *writeWhitelist) matches(path string) bool {
	for _, p := range w.paths {
		if path == p || strings.HasPrefix(path, p+"/") {
			return true
		}
	}
	return false
}
