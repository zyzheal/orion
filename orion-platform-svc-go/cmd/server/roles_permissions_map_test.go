package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// TestRolesPermissionsMapServed pins PERM-7 and records the deeper gap it
// exposed.
//
// usePermission.ts has always fetched GET /api/v1/roles/permissions-map, but no
// route ever served it, so the client silently fell back to its hardcoded
// ROLE_PERMISSIONS_FALLBACK and every backend permission change stayed invisible
// to the UI. This test pins the endpoint, the envelope shape, and the content.
//
// The final assertion is a deliberately inverted regression guard for the deeper
// problem: with AUTH_OPTIONAL_ENABLED unset (the default), no middleware in the
// /api/v1 chain ever calls c.Set("role", ...), so c.Get("role") is always empty
// and every auth.RequirePermission guard answers 403 "no role assigned" to all
// callers. optional_auth_test.go proves that flipping the env var makes the
// guards real for token-bearing callers; this assertion stays true because the
// middleware is off by default, which is what keeps token-less callers working.
func TestRolesPermissionsMapServed(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("JWT_SECRET", "test-secret")
	t.Setenv("REDIS_ADDR", "localhost:6379")
	t.Setenv("DB_USER", "postgres")
	t.Setenv("DB_PASSWORD", "postgres")

	logger := zap.NewNop()
	infra := stubInfrastructure(logger)
	initWiring(infra, logger)
	r := setupRouter(infra, logger)
	if r == nil {
		t.Fatal("setupRouter returned nil engine")
	}

	do := func(method, path, body string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, nil)
		if body != "" {
			req.Body = io.NopCloser(strings.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
		}
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w
	}

	// 1. The endpoint answers with the envelope usePermission.ts accepts. The
	//    client gates on body.success, so any other shape silently falls back and
	//    re-breaks the sync.
	w := do(http.MethodGet, "/api/v1/roles/permissions-map", "")
	if w.Code != http.StatusOK {
		t.Fatalf("GET /roles/permissions-map = %d, want 200: %s", w.Code, w.Body.String())
	}

	var env struct {
		Success bool                `json:"success"`
		Data    map[string][]string `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
		t.Fatalf("permissions-map payload is not JSON: %v\n%s", err, w.Body.String())
	}
	if !env.Success {
		t.Fatalf("permissions-map must set success:true for usePermission.ts to accept it; got %s", w.Body.String())
	}
	if len(env.Data) < 40 {
		t.Fatalf("permissions-map returned %d roles, want >= 40 (the whole table, not a subset)", len(env.Data))
	}
	if perms := env.Data["admin"]; !containsPerm(perms, "*:*") {
		t.Fatalf(`role "admin" carries no "*:*" grant: %v`, perms)
	}
	t.Logf("permissions-map served %d roles", len(env.Data))

	// 2. PERM-7 regression guard: /roles/permissions-map must stay UNGUARDED.
	// This endpoint exists so usePermission.ts derives menu locks from the live
	// permission table instead of a hardcoded client copy. Under the current
	// wiring (OptionalAuth off by default) a guard would 403 every caller and
	// the client would silently fall back to its stale copy, undoing PERM-7.
	// PERM-8 stage 2 must handle this endpoint deliberately — e.g. keep it
	// unguarded or exempt it — rather than mounting a blanket guard.
	wMap := do(http.MethodGet, "/api/v1/roles/permissions-map", "")
	if wMap.Code != http.StatusOK {
		t.Fatalf("GET /roles/permissions-map = %d, want 200 — it must stay unguarded to keep PERM-7 working: %s", wMap.Code, wMap.Body.String())
	}

	// 3. The static sibling must not have displaced the /roles/:id wildcard.
	w = do(http.MethodGet, "/api/v1/roles", "")
	if w.Code == http.StatusForbidden {
		t.Fatalf("GET /roles answered 403 — the unguarded list endpoint is now behind a guard")
	}

	// 3. PERM-8 evidence: a guarded route rejects every caller because nothing in
	//    the /api/v1 chain ever calls c.Set("role", ...).
	w = do(http.MethodPost, "/api/v1/roles", `{"name":"probe"}`)
	if w.Code != http.StatusForbidden {
		t.Fatalf("POST /roles = %d, want 403 while auth middleware is unwired (PERM-8)", w.Code)
	}
	if !strings.Contains(w.Body.String(), "no role assigned") {
		t.Fatalf("403 body no longer says 'no role assigned' — role resolution changed: %s", w.Body.String())
	}
	t.Log("AUTH_OPTIONAL_ENABLED unset: guarded routes reject every caller, no role is ever set")
}

func containsPerm(perms []string, want string) bool {
	for _, p := range perms {
		if p == want {
			return true
		}
	}
	return false
}
