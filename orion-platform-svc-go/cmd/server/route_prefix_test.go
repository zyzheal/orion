package main

import (
	"sort"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// buildProductionRouter assembles the router the same way main does, so the
// assertions below see the routes a real process serves rather than a mirror of
// them. The two dump tests in this package rebuild the route graph by hand from
// each handler's RegisterRoutes signature; that mirror is faithful but covers
// 3525 of the 3578 routes setupRouter actually registers, so it cannot be the
// authority for a route-shape invariant.
func buildProductionRouter(t *testing.T) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	t.Setenv("JWT_SECRET", "test-secret")
	t.Setenv("REDIS_ADDR", "localhost:6379")
	t.Setenv("DB_USER", "postgres")
	t.Setenv("DB_PASSWORD", "postgres")

	logger := zap.NewNop()
	infra := stubInfrastructure(logger)
	initWiring(infra, logger)
	return setupRouter(infra, logger)
}

// doubledSegment returns the repeated k-segment prefix of a path, or "".
// k ranges over 1..4 because the doubling can straddle a version segment:
// /api/v1/api/v1/ai/models alternates api,v1,api,v1, so no two *adjacent*
// segments are equal and an adjacency-only check misses it entirely.
func doubledSegment(path string) string {
	seg := strings.Split(strings.Trim(path, "/"), "/")
	for k := 1; k <= 4; k++ {
		for i := 0; i+2*k <= len(seg); i++ {
			if strings.Join(seg[i:i+k], "/") == strings.Join(seg[i+k:i+2*k], "/") {
				return strings.Join(seg[i:i+k], "/")
			}
		}
	}
	return ""
}

// TestProductionRoutes_HaveNoPrefixDoubling walks the assembled router and
// requires that the only doubled registration in the whole API is the one that
// cannot be removed.
//
// Four handlers used to re-add a prefix their injected group already carried:
// aiModelsH wrote /api/v1/ai/models onto /api/v1 (14 registrations, all 14 of
// its routes), authH wrote /auth/* onto /auth and /api/v1/auth (8, all 8),
// pandawikiH wrote /docs/tags and /docs/toc onto /docs (2 of 18), and
// statisticsH wrote /stats onto /stats (1 of 6). That was 25 of 3578
// registrations -- roughly 1 in 143 -- and none of it was reachable.
//
// A grep cannot find this class: the doubled prefix appears as two separate
// string literals on different lines, and a source scan that only looks at
// adjacent equal segments misses /api/v1/api/v1 because its segments alternate.
// Only walking the assembled router sees the resolved path.
func TestProductionRoutes_HaveNoPrefixDoubling(t *testing.T) {
	r := buildProductionRouter(t)

	var doubled []string
	for _, rt := range r.Routes() {
		if hit := doubledSegment(rt.Path); hit != "" {
			doubled = append(doubled, rt.Method+" "+rt.Path+" [repeated="+hit+"]")
		}
	}
	sort.Strings(doubled)

	want := []string{"GET /api/v1/stats/stats [repeated=stats]"}
	if len(doubled) != len(want) {
		t.Fatalf("found %d doubled registrations, want exactly %d:\n%s",
			len(doubled), len(want), strings.Join(doubled, "\n"))
	}
	for i := range want {
		if doubled[i] != want[i] {
			t.Fatalf("doubled registration %d = %q, want %q", i, doubled[i], want[i])
		}
	}
}

// TestProductionRoutes_StatsOwnershipForcesTheDoubling records why that one
// survivor is pinned rather than fixed. statisticsH cannot use "" because
// /api/v1/stats already belongs to eventbusH, which registers directly on api
// with no sub-group; Gin panics on the second claimant and the process never
// starts.
func TestProductionRoutes_StatsOwnershipForcesTheDoubling(t *testing.T) {
	r := buildProductionRouter(t)

	var bare, doubled string
	for _, rt := range r.Routes() {
		switch rt.Method + " " + rt.Path {
		case "GET /api/v1/stats":
			bare = rt.Handler
		case "GET /api/v1/stats/stats":
			doubled = rt.Handler
		}
	}
	if bare == "" {
		t.Fatal("GET /api/v1/stats is not registered, so the ownership claim in the statistics handler is stale")
	}
	if doubled == "" {
		t.Fatal("GET /api/v1/stats/stats is not registered, so the doubled spelling the statistics handler pins is gone")
	}
	if strings.Contains(bare, "internal/statistics") {
		t.Fatalf("GET /api/v1/stats is owned by the statistics handler (%s); the doubled sibling can now be cleaned up", bare)
	}
	if strings.Contains(doubled, "internal/eventbus") {
		t.Fatalf("GET /api/v1/stats/stats is owned by the eventbus handler (%s)", doubled)
	}
	if !strings.Contains(bare, "internal/eventbus") {
		t.Fatalf("GET /api/v1/stats is owned by %s, not eventbusH; update the statistics handler comment", bare)
	}
}

// TestProductionRoutes_FourFixedFamiliesAreMounted asserts the corrected
// families resolve at production level. Per-handler tests already pin their
// exact sets, but this catches the separate failure mode of a handler being
// dropped from the registerRoutes list in router.go.
func TestProductionRoutes_FourFixedFamiliesAreMounted(t *testing.T) {
	r := buildProductionRouter(t)

	seen := make(map[string]bool)
	for _, rt := range r.Routes() {
		seen[rt.Method+" "+rt.Path] = true
	}

	want := []string{
		"POST /auth/login",
		"POST /auth/register",
		"POST /auth/refresh",
		"POST /api/v1/auth/logout",
		"GET /api/v1/auth/me",
		"GET /api/v1/auth/providers",
		"GET /api/v1/auth/policies",
		"POST /api/v1/auth/providers",
		"GET /api/v1/ai/models",
		"POST /api/v1/ai/models",
		"GET /api/v1/ai/models/:id/versions/:versionId",
		"POST /api/v1/ai/models/:id/versions/:versionId/promote",
		"POST /api/v1/ai/models/:id/versions/:versionId/rollback",
		"GET /api/v1/docs/tags",
		"GET /api/v1/docs/toc",
		"GET /api/v1/docs/graph",
	}
	for _, w := range want {
		if !seen[w] {
			t.Errorf("%s is not registered", w)
		}
	}

	// The old spellings must be gone.
	absent := []string{
		"POST /auth/auth/login",
		"GET /api/v1/auth/auth/me",
		"GET /api/v1/docs/docs/tags",
		"GET /api/v1/docs/docs/toc",
	}
	for _, a := range absent {
		if seen[a] {
			t.Errorf("%s is still registered", a)
		}
	}

	// No resolved path may carry the version prefix twice.
	for _, rt := range r.Routes() {
		if strings.Contains(rt.Path, "/api/v1/api/v1") {
			t.Errorf("%s %s re-adds the /api/v1 prefix", rt.Method, rt.Path)
		}
	}
}
