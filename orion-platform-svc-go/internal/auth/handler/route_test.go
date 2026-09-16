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

// TestHandler_RegisterRoutes_PinsBothGroups pins the eight auth registrations
// against the two groups setupRouter passes in.
//
// router.go mounts RegisterRoutes with r.Group("/auth") and
// r.Group("/api/v1").Group("/auth"), so the handler's paths must be bare.
// They used to all start with "/auth", which produced /auth/auth/login and
// /api/v1/auth/auth/me -- eight endpoints no caller could ever reach. Nothing
// in the repository references auth/auth: the wrong paths were reachable only
// in theory, which is what made them invisible to every existing check.
func TestHandler_RegisterRoutes_PinsBothGroups(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	NewHandler(nil).RegisterRoutes(r.Group("/auth"), r.Group("/api/v1").Group("/auth"))

	got := resolvedRoutes(r)
	want := []string{
		"GET /api/v1/auth/me",
		"GET /api/v1/auth/policies",
		"GET /api/v1/auth/providers",
		"POST /api/v1/auth/logout",
		"POST /api/v1/auth/providers",
		"POST /auth/login",
		"POST /auth/refresh",
		"POST /auth/register",
	}
	assertRouteSet(t, got, want)
	assertNoReusedSegment(t, got)
	for _, line := range got {
		if strings.Contains(line, "/auth/auth") {
			t.Errorf("%s repeats the /auth segment its group already carries", line)
		}
	}
}
