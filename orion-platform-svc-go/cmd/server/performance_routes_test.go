package main

import (
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// TestPerformanceRoutesAreMounted pins the eleven /performance endpoints onto
// the assembled router.
//
// perfH is registered through the shared registerRoutes list in setupRouter,
// not through its own nil guard. A test written against the assumption that it
// had never been routed once added a second perfH.RegisterRoutes(api) call and
// Gin panicked with "handlers are already registered" -- the routes had been
// reachable all along. What neither `go build`, `go vet` nor the route-conflict
// tests can see is the other direction: perfH removed from that list is valid
// code that silently deletes eleven endpoints. Walking r.Routes() and asserting
// each path is present is the only check that catches it.
func TestPerformanceRoutesAreMounted(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Setenv("JWT_SECRET", "test-secret")
	t.Setenv("REDIS_ADDR", "localhost:6379")
	t.Setenv("DB_USER", "postgres")
	t.Setenv("DB_PASSWORD", "postgres")

	logger := zap.NewNop()
	infra := stubInfrastructure(logger)
	initWiring(infra, logger)

	r := setupRouter(infra, logger)

	seen := make(map[string]bool)
	for _, route := range r.Routes() {
		seen[route.Method+" "+route.Path] = true
	}

	// One entry per line of performance.Handler.RegisterRoutes.
	want := []string{
		"POST /api/v1/performance/baselines",
		"GET /api/v1/performance/baselines",
		"GET /api/v1/performance/baselines/:id",
		"GET /api/v1/performance/baselines/:id/evaluations",
		"POST /api/v1/performance/evaluate",
		"GET /api/v1/performance/profile/:serviceName",
		"GET /api/v1/performance/profile/:serviceName/bottlenecks",
		"GET /api/v1/performance/profile/:serviceName/suggestions",
		"POST /api/v1/performance/regression",
		"POST /api/v1/performance/test-results",
		"GET /api/v1/performance/test-results/:service",
	}
	for _, route := range want {
		if !seen[route] {
			t.Errorf("route %s is not registered", route)
		}
	}

	// performance.Handler nests its own /performance group, so passing
	// api.Group("/performance") would yield a doubled prefix that silently
	// moves every endpoint.
	for _, route := range r.Routes() {
		if strings.Contains(route.Path, "/performance/performance") {
			t.Errorf("doubled prefix on %s %s", route.Method, route.Path)
		}
	}

	// POST /performance/vitals is the only /performance route that predates this
	// module; the performance handler must not have shadowed it.
	if !seen["POST /api/v1/performance/vitals"] {
		t.Error("POST /api/v1/performance/vitals disappeared after mounting performance")
	}
}
