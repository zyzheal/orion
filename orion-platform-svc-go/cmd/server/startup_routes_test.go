package main

import (
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// TestStartupRoutesAreMounted pins the eleven /startup endpoints onto the
// assembled router.
//
// startupH is registered through the shared registerRoutes list in setupRouter
// rather than through its own nil guard, so removing it from that list is
// valid Go that silently deletes eleven endpoints -- go build, go vet and the
// route-conflict tests all stay green. Walking r.Routes() is the only check
// that sees the absence.
func TestStartupRoutesAreMounted(t *testing.T) {
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

	// One entry per line of startup.Handler.RegisterRoutes.
	want := []string{
		"POST /api/v1/startup/start",
		"POST /api/v1/startup/stop",
		"GET /api/v1/startup/status",
		"POST /api/v1/startup/modules",
		"GET /api/v1/startup/modules",
		"GET /api/v1/startup/modules/:id",
		"PUT /api/v1/startup/modules/:id",
		"DELETE /api/v1/startup/modules/:id",
		"POST /api/v1/startup/modules/:id/init",
		"POST /api/v1/startup/modules/:id/health",
		"POST /api/v1/startup/modules/:id/depends",
	}
	for _, route := range want {
		if !seen[route] {
			t.Errorf("route %s is not registered", route)
		}
	}

	// startup.Handler nests its own /startup group, so passing
	// api.Group("/startup") would yield a doubled prefix that silently moves
	// every endpoint.
	for _, route := range r.Routes() {
		if strings.Contains(route.Path, "/startup/startup") {
			t.Errorf("doubled prefix on %s %s", route.Method, route.Path)
		}
	}
}
