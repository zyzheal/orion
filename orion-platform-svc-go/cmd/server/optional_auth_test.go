package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"go.uber.org/zap"
)

// PERM-8, phase 1.
//
// Before this batch nothing in the /api/v1 chain called c.Set("role", ...), so
// all 3640 auth.RequirePermission guards answered 403 "no role assigned" to
// every caller. The guards were dead code, not authorisation.
//
// The fix is optional (non-blocking) authentication, off by default behind
// AUTH_OPTIONAL_ENABLED: token-bearing callers get a real identity and the
// guards enforce for real; everyone else keeps working exactly as before.
// These tests pin both halves of that contract.

const testJWTSecret = "test-secret"

// signTestToken mints an HS256 token shaped like the claims Auth expects.
// withTenant=false produces a valid token that omits the tenant_id claim, which
// strict Auth rejects but optional mode must still accept.
func signTestToken(t *testing.T, role string, withTenant bool) string {
	t.Helper()
	claims := jwt.MapClaims{
		"sub": "test-user-1",
		"exp": time.Now().Add(24 * time.Hour).Unix(),
	}
	if withTenant {
		claims["tenant_id"] = "tenant-1"
	}
	if role != "" {
		claims["role"] = role
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(testJWTSecret))
	if err != nil {
		t.Fatalf("failed to sign test token: %v", err)
	}
	return token
}

// signTestTokenRoles mints a token whose "roles" array carries several roles
// while the legacy single "role" claim stays on the least-privileged one. That
// is exactly the shape the guards used to downgrade to the single role only.
func signTestTokenRoles(t *testing.T, primary string, roles []string, withTenant bool) string {
	t.Helper()
	claims := jwt.MapClaims{
		"sub":   "test-user-1",
		"exp":   time.Now().Add(24 * time.Hour).Unix(),
		"roles": roles,
	}
	if withTenant {
		claims["tenant_id"] = "tenant-1"
	}
	if primary != "" {
		claims["role"] = primary
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(testJWTSecret))
	if err != nil {
		t.Fatalf("failed to sign test token: %v", err)
	}
	return token
}

// newTestRouter assembles the real router with AUTH_OPTIONAL_ENABLED either set
// or unset. JWT_SECRET must equal testJWTSecret so the router's OptionalAuth
// config verifies the tokens these tests mint.
func newTestRouter(t *testing.T, optionalAuthOn bool) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	t.Setenv("JWT_SECRET", testJWTSecret)
	t.Setenv("REDIS_ADDR", "localhost:6379")
	t.Setenv("DB_USER", "postgres")
	t.Setenv("DB_PASSWORD", "postgres")
	if optionalAuthOn {
		t.Setenv("AUTH_OPTIONAL_ENABLED", "true")
	} else {
		t.Setenv("AUTH_OPTIONAL_ENABLED", "")
	}

	logger := zap.NewNop()
	infra := stubInfrastructure(logger)
	initWiring(infra, logger)
	r := setupRouter(infra, logger)
	if r == nil {
		t.Fatal("setupRouter returned nil engine")
	}
	return r
}

// postRoles hits a guarded write endpoint. role:write is held by admin (via
// *:*) and denied to viewer.
func postRoles(r *gin.Engine, token string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/roles", io.NopCloser(strings.NewReader(`{"name":"probe"}`)))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

// The default must stay token-less-safe: with the env var unset the guards still
// reject and no caller can be newly 401'd.
func TestOptionalAuthOffByDefault(t *testing.T) {
	r := newTestRouter(t, false)

	w := postRoles(r, "")
	if w.Code != http.StatusForbidden {
		t.Fatalf("POST /roles = %d, want 403 with optional auth disabled: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "no role assigned") {
		t.Fatalf("403 body no longer says 'no role assigned': %s", w.Body.String())
	}
}

// Enabling the middleware must not change the outcome for any caller that was
// working before: no token, same 403, same body. This is the property that makes
// the flag safe to flip in production without a client migration.
func TestOptionalAuthDoesNotBreakTokenlessCallers(t *testing.T) {
	r := newTestRouter(t, true)

	w := postRoles(r, "")
	if w.Code != http.StatusForbidden {
		t.Fatalf("token-less POST /roles = %d, want 403 (optional auth must not enforce): %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "no role assigned") {
		t.Fatalf("token-less 403 body changed - optional auth leaked a role: %s", w.Body.String())
	}

	// Unguarded endpoints must remain reachable.
	req := httptest.NewRequest(http.MethodGet, "/api/v1/roles/permissions-map", nil)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("GET /roles/permissions-map = %d, want 200: %s", w.Code, w.Body.String())
	}
}

// The whole point of the flag: with a valid token the guards stop being dead
// code and enforce the role actually present in the token.
func TestOptionalAuthEnforcesGuardsForValidToken(t *testing.T) {
	r := newTestRouter(t, true)

	// admin holds *:*, so the role:write guard must pass.
	w := postRoles(r, signTestToken(t, "admin", true))
	if w.Code == http.StatusForbidden {
		t.Fatalf("admin token got 403 - the role:write guard did not honour a valid *:* grant: %s", w.Body.String())
	}

	// viewer has no role:* grant, so the same guard must deny with a real
	// authorisation message rather than "no role assigned".
	w = postRoles(r, signTestToken(t, "viewer", true))
	if w.Code != http.StatusForbidden {
		t.Fatalf("viewer token got %d, want 403: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "insufficient permissions") {
		t.Fatalf("viewer 403 body should say 'insufficient permissions', got %s", w.Body.String())
	}

	// A garbage token degrades to anonymous instead of a hard 401.
	w = postRoles(r, "definitely-not-a-jwt")
	if w.Code != http.StatusForbidden || !strings.Contains(w.Body.String(), "no role assigned") {
		t.Fatalf("invalid token should fall back to anonymous + 403, got %d %s", w.Code, w.Body.String())
	}

	// Optional mode must not require tenant_id (strict Auth does).
	w = postRoles(r, signTestToken(t, "admin", false))
	if w.Code == http.StatusForbidden {
		t.Fatalf("token without tenant_id got 403 - optional auth should not require tenant_id: %s", w.Body.String())
	}
}

// PERM-9, end to end. A token holding several roles must get the union of their
// grants: JWT "roles" array -> ParseClaims -> applyClaims -> GetRoles ->
// RequirePermission. Before PERM-9 the guard read only the single "role" claim,
// so this caller was downgraded to viewer and denied.
func TestOptionalAuthMultiRoleUnion(t *testing.T) {
	r := newTestRouter(t, true)

	// POST /pipeline/validate is guarded by pipeline:write. viewer lacks it,
	// pipeline.editor has it.
	do := func(token string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/pipeline/validate",
			io.NopCloser(strings.NewReader(`{"name":"probe"}`)))
		req.Header.Set("Content-Type", "application/json")
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w
	}

	w := do(signTestToken(t, "viewer", true))
	if w.Code != http.StatusForbidden || !strings.Contains(w.Body.String(), "insufficient permissions") {
		t.Fatalf("viewer = %d %s, want 403 insufficient permissions", w.Code, w.Body.String())
	}

	w = do(signTestTokenRoles(t, "viewer", []string{"viewer", "pipeline.editor"}, true))
	if w.Code == http.StatusForbidden {
		t.Fatalf("multi-role caller got 403 - the guard must use the union of the held roles: %s", w.Body.String())
	}
}
