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

// TestHandler_RegisterRoutes_PinsAllEighteen pins every pandawiki registration.
//
// The handler mounts on /api/v1 and owns two groups, /spaces and /docs. Two
// registrations used to repeat the /docs prefix -- /docs/docs/tags and
// /docs/docs/toc -- copied from internal/knowledge, whose group is /knowledge
// and whose /docs/tags spelling is correct there.
func TestHandler_RegisterRoutes_PinsAllEighteen(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	NewHandler(nil).RegisterRoutes(r.Group("/api/v1"))

	got := resolvedRoutes(r)
	want := []string{
		"DELETE /api/v1/docs/:id",
		"DELETE /api/v1/spaces/:id",
		"GET /api/v1/docs",
		"GET /api/v1/docs/:id",
		"GET /api/v1/docs/:id/versions",
		"GET /api/v1/docs/graph",
		"GET /api/v1/docs/sync/logs",
		"GET /api/v1/docs/tags",
		"GET /api/v1/docs/toc",
		"GET /api/v1/spaces",
		"GET /api/v1/spaces/:id",
		"POST /api/v1/docs",
		"POST /api/v1/docs/rag/query",
		"POST /api/v1/docs/rag/retrieve",
		"POST /api/v1/docs/sync",
		"POST /api/v1/spaces",
		"PUT /api/v1/docs/:id",
		"PUT /api/v1/spaces/:id",
	}
	assertRouteSet(t, got, want)
	assertNoReusedSegment(t, got)
}
