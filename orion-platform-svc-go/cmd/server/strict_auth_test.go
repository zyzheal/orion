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

// PERM-8, stage 2.
//
// Strict mode (auth.Auth behind AUTH_STRICT_ENABLED) is the breaking half of the
// migration: every request to the /api/v1 chain must present a valid Bearer
// token whose claims include both sub and tenant_id, or it gets a hard 401.
// These tests pin that contract so that flipping the env var in production is a
// config change, not a code change.
//
// The two modes are mutually exclusive deployment states: OptionalAuth exists to
// phase the migration in without breaking anonymous callers, Auth exists to
// finish it. The first half of the contract (what Auth rejects) is tested here;
// the exemptions that must keep working token-less are pinned below too, because
// a blanket guard would silently undo PERM-7.

// newStrictTestRouter assembles the real router with AUTH_STRICT_ENABLED=1 and
// AUTH_OPTIONAL_ENABLED unset, matching the documented deployment state. JWT_SECRET
// must equal testJWTSecret so the router's Auth config verifies these test tokens.
func newStrictTestRouter(t *testing.T) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	t.Setenv("JWT_SECRET", testJWTSecret)
	t.Setenv("REDIS_ADDR", "localhost:6379")
	t.Setenv("DB_USER", "postgres")
	t.Setenv("DB_PASSWORD", "postgres")
	t.Setenv("AUTH_OPTIONAL_ENABLED", "") // strict and optional are mutually exclusive
	t.Setenv("AUTH_STRICT_ENABLED", "true")

	logger := zap.NewNop()
	infra := stubInfrastructure(logger)
	initWiring(infra, logger)
	r := setupRouter(infra, logger)
	if r == nil {
		t.Fatal("setupRouter returned nil engine")
	}
	return r
}

// signTestTokenNoSub mints a token that omits the sub claim but carries
// tenant_id — the shape strict Auth must reject ("token missing user ID") and
// the only way to exercise that branch, since signTestToken always sets sub.
func signTestTokenNoSub(t *testing.T) string {
	t.Helper()
	claims := jwt.MapClaims{
		"exp":       time.Now().Add(24 * time.Hour).Unix(),
		"tenant_id": "tenant-1",
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(testJWTSecret))
	if err != nil {
		t.Fatalf("failed to sign token without sub: %v", err)
	}
	return token
}

func doRequest(r *gin.Engine, method, path, body, token string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, nil)
	if body != "" {
		req.Body = io.NopCloser(strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

// Off by default: with AUTH_STRICT_ENABLED unset no caller can be newly 401'd,
// which is what keeps existing deployments safe until the flag is flipped.
func TestStrictAuthOffByDefault(t *testing.T) {
	r := newTestRouter(t, false)

	w := postRoles(r, "")
	if w.Code != http.StatusForbidden {
		t.Fatalf("token-less POST /roles = %d, want 403 (guard behaviour, not a strict 401): %s", w.Code, w.Body.String())
	}
}

// The core strict contract: a missing Authorization header is a hard 401, not an
// anonymous downgrade.
func TestStrictAuthRejectsMissingToken(t *testing.T) {
	r := newStrictTestRouter(t)

	w := postRoles(r, "")
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("token-less POST /roles = %d, want 401: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "missing authorization header") {
		t.Fatalf("401 body should say 'missing authorization header', got %s", w.Body.String())
	}
}

// A non-Bearer Authorization header must be rejected, not silently ignored.
func TestStrictAuthRejectsNonBearerHeader(t *testing.T) {
	r := newStrictTestRouter(t)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/roles", io.NopCloser(strings.NewReader(`{"name":"probe"}`)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Basic dXNlcjpwYXNz")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("non-Bearer POST /roles = %d, want 401: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "invalid authorization format, expected Bearer token") {
		t.Fatalf("401 body should say 'invalid authorization format, expected Bearer token', got %s", w.Body.String())
	}
}

// Strict mode requires tenant_id — the claim the platform authenticates
// per-tenant resources off. Optional mode tolerates its absence; Auth must not.
func TestStrictAuthRejectsMissingTenantID(t *testing.T) {
	r := newStrictTestRouter(t)

	w := postRoles(r, signTestToken(t, "admin", false))
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("token without tenant_id = %d, want 401: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "token missing tenant ID") {
		t.Fatalf("401 body should say 'token missing tenant ID', got %s", w.Body.String())
	}
}

// A token with tenant_id but no sub is malformed for this platform: user_id is
// the other half of the identity.
func TestStrictAuthRejectsMissingSub(t *testing.T) {
	r := newStrictTestRouter(t)

	w := postRoles(r, signTestTokenNoSub(t))
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("token without sub = %d, want 401: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "token missing user ID") {
		t.Fatalf("401 body should say 'token missing user ID', got %s", w.Body.String())
	}
}

// A garbage token is a hard 401 in strict mode (OptionalAuth degrades it to
// anonymous — that difference is the point of the two modes).
func TestStrictAuthRejectsInvalidToken(t *testing.T) {
	r := newStrictTestRouter(t)

	w := postRoles(r, "definitely-not-a-jwt")
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("garbage token = %d, want 401: %s", w.Code, w.Body.String())
	}
}

// A valid token passes the guard; strict mode makes the guards real for the
// identity the token carries, exactly like OptionalAuth but blocking.
func TestStrictAuthAcceptsValidToken(t *testing.T) {
	r := newStrictTestRouter(t)

	// admin holds *:*, so the role:write guard must pass the request through the
	// middleware. The handler outcome is not the point here — the middleware must
	// not 401 (token valid) nor leave the guard to 403 (identity applied).
	w := postRoles(r, signTestToken(t, "admin", true))
	if w.Code == http.StatusUnauthorized || w.Code == http.StatusForbidden {
		t.Fatalf("valid admin token = %d, want the request past the middleware and guard: %s", w.Code, w.Body.String())
	}

	// viewer has no role:* grant: 403 must now be a real authorisation verdict
	// ("insufficient permissions"), never "no role assigned".
	w = postRoles(r, signTestToken(t, "viewer", true))
	if w.Code != http.StatusForbidden {
		t.Fatalf("viewer token = %d, want 403: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "insufficient permissions") {
		t.Fatalf("viewer 403 body should say 'insufficient permissions', got %s", w.Body.String())
	}
}

// SkipPaths are deliberate token-less holes. The load-bearing one is
// /roles/permissions-map: PERM-7 exists so usePermission.ts derives menu locks
// from the live permission table, and a blanket strict guard would 401 the
// bootstrap call and silently revert the client to its stale hardcoded copy.
// /routes is the route-discovery endpoint used by developer tooling.
func TestStrictAuthSkipPathsStayUnguarded(t *testing.T) {
	r := newStrictTestRouter(t)

	w := doRequest(r, http.MethodGet, "/api/v1/roles/permissions-map", "", "")
	if w.Code != http.StatusOK {
		t.Fatalf("GET /roles/permissions-map without token = %d, want 200 (SkipPath exemption keeps PERM-7 alive): %s", w.Code, w.Body.String())
	}

	w = doRequest(r, http.MethodGet, "/api/v1/routes", "", "")
	if w.Code != http.StatusOK {
		t.Fatalf("GET /routes without token = %d, want 200 (SkipPath exemption): %s", w.Code, w.Body.String())
	}
}
