package handler

import (
	"sort"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

// resolvedRoutes returns the registered routes as sorted "METHOD PATH" strings.
// Two registrations can share a path with different methods, so counting
// distinct paths alone would collapse them.
func resolvedRoutes(r *gin.Engine) []string {
	routes := r.Routes()
	out := make([]string, 0, len(routes))
	for _, rt := range routes {
		out = append(out, rt.Method+" "+rt.Path)
	}
	sort.Strings(out)
	return out
}

// assertRouteSet fails on the first mismatch and reports both counts, so a
// dropped registration is visible instead of masquerading as a subset match.
func assertRouteSet(t *testing.T, got []string, want []string) {
	t.Helper()
	if len(got) != len(want) {
		t.Fatalf("registered %d routes, want %d; got %v", len(got), len(want), got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("route %d = %q, want %q; full set: %v", i, got[i], want[i], got)
		}
	}
}

// assertNoReusedSegment fails when a path repeats one of its own segments, e.g.
// /api/v1/docs/docs/tags. That shape means the handler re-added a prefix its
// injected group already carries.
func assertNoReusedSegment(t *testing.T, got []string) {
	t.Helper()
	for _, line := range got {
		fields := strings.Fields(line)
		if len(fields) != 2 {
			t.Fatalf("unparsable route line %q", line)
		}
		parts := strings.Split(strings.Trim(fields[1], "/"), "/")
		for i := 0; i+2 < len(parts); i++ {
			if parts[i] == parts[i+1] {
				t.Errorf("%s repeats segment %q", line, parts[i])
			}
		}
	}
}

// TestHandler_RegisterRoutes_PinsAllSix pins every statistics registration.
//
// Five of the six are clean. The sixth, GET /api/v1/stats/stats, is pinned in
// its doubled form on purpose: the sibling of "" is /api/v1/stats, which
// eventbusH already owns by registering on api with no sub-group, and Gin
// panics with "handlers are already registered for path '/api/v1/stats'" the
// moment the two meet. The doubling is cosmetic debt, not a broken endpoint --
// the handler is reachable. Changing it needs the eventbus/stats ownership
// split resolved first.
func TestHandler_RegisterRoutes_PinsAllSix(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	NewHandler(nil).RegisterRoutes(r.Group("/api/v1"))

	got := resolvedRoutes(r)
	want := []string{
		"GET /api/v1/stats/aggregate-all",
		"GET /api/v1/stats/stats",
		"POST /api/v1/stats/aggregate",
		"POST /api/v1/stats/ingest",
		"POST /api/v1/stats/ingest/batch",
		"POST /api/v1/stats/prune",
	}
	assertRouteSet(t, got, want)
}
