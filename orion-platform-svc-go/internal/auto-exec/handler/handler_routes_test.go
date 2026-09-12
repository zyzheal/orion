package handler

import (
	"strings"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"

	"orion/platform-svc-go/internal/auto-exec/engine"
	"orion/platform-svc-go/internal/auto-exec/repository"
	"orion/platform-svc-go/internal/auto-exec/service"

	"github.com/gin-gonic/gin"
)

// newTestHandler builds the real handler over a sqlmock database so the tests
// exercise the production wiring instead of a hand-rolled fake. The service is
// never called here; only route registration is under test.
func newTestHandler(t *testing.T) *Handler {
	t.Helper()
	db, _, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	repo := repository.NewRepository(sqlx.NewDb(db, "postgres"))
	eng := engine.NewAutoExecEngine(repo, zap.NewNop())
	return NewHandler(service.NewService(eng, repo))
}

// wantRoutes is the complete (method, path) set the module must expose.
func wantRoutes() []string {
	return []string{
		"POST:/api/v1/auto-exec/tasks",
		"GET:/api/v1/auto-exec/tasks",
		"GET:/api/v1/auto-exec/tasks/:id",
		"DELETE:/api/v1/auto-exec/tasks/:id",
		"POST:/api/v1/auto-exec/tasks/:id/run",
		"GET:/api/v1/auto-exec/tasks/:id/history",
		"POST:/api/v1/auto-exec/plugins",
		"GET:/api/v1/auto-exec/plugins",
		"GET:/api/v1/auto-exec/plugins/:id",
		"PUT:/api/v1/auto-exec/plugins/:id",
	}
}

func gotRoutes(t *testing.T) map[string]bool {
	t.Helper()
	gin.SetMode(gin.TestMode)
	e := gin.New()
	api := e.Group("/api/v1")
	func() {
		defer func() {
			if r := recover(); r != nil {
				t.Fatalf("RegisterRoutes panicked: %v", r)
			}
		}()
		newTestHandler(t).RegisterRoutes(api)
	}()
	out := make(map[string]bool, len(e.Routes()))
	for _, r := range e.Routes() {
		out[r.Method+":"+r.Path] = true
	}
	return out
}

// Every handler method in this package must have a route.
//
// Nine of the eleven used to have none: the module mounted its three live routes
// straight on /tasks and /plugins, which belong to ai-intelligence and
// internal/plugin, so the remaining (method, path) pairs had nowhere to go and
// CreateTask, ListTasks, GetTask, DeleteTask, RegisterPlugin, ListPlugins and
// GetPlugin were unreachable from HTTP. That is invisible to go build and go vet
// — the code compiles and nothing at startup complains about an empty registry.
func TestRegisterRoutesExposesEveryHandlerMethod(t *testing.T) {
	got := gotRoutes(t)

	want := make(map[string]bool, len(wantRoutes()))
	for _, w := range wantRoutes() {
		want[w] = true
	}
	for w := range want {
		if !got[w] {
			t.Errorf("route %s is not registered", w)
		}
	}
	if len(got) != len(want) {
		t.Errorf("expected exactly %d auto-exec routes, got %d", len(want), len(got))
		for k := range got {
			t.Logf("  got: %s", k)
		}
	}
}

// No auto-exec route may occupy a path another domain owns. /api/v1/tasks is
// ai-intelligence's collection and /api/v1/plugins is internal/plugin's, so a
// route on either would be silently unreachable (it lands behind the first
// registration, which is not this module's).
func TestRegisterRoutesStaysInsideTheAutoExecNamespace(t *testing.T) {
	got := gotRoutes(t)
	for k := range got {
		method, path := k[:4], k[4:]
		// Exact prefix check: /api/v1/tasks/:id is ai-intelligence's too, so a
		// stray sub-route is caught as well.
		if strings.HasPrefix(path, "/api/v1/tasks") || strings.HasPrefix(path, "/api/v1/plugins") {
			t.Errorf("auto-exec claimed %s %s, which belongs to another domain", method, path)
		}
	}
}

// Gin panics on a duplicate (method, path) pair. That panic is exactly why the
// module dropped routes one at a time instead of moving its namespace, so this
// pins that registering next to a domain that already owns /tasks and /plugins
// is safe and leaves the foreign routes intact.
func TestRegisterRoutesCoexistsWithForeignTaskAndPluginOwners(t *testing.T) {
	gin.SetMode(gin.TestMode)
	e := gin.New()
	api := e.Group("/api/v1")
	foreign := []struct{ m, p string }{
		{"POST", "/tasks"}, {"GET", "/tasks"},
		{"GET", "/tasks/:id"}, {"DELETE", "/tasks/:id"},
		{"POST", "/plugins"}, {"GET", "/plugins"},
		{"GET", "/plugins/:id"}, {"DELETE", "/plugins/:id"},
		{"PATCH", "/plugins/:id"},
	}
	for _, f := range foreign {
		api.Handle(f.m, f.p, func(c *gin.Context) {})
	}

	func() {
		defer func() {
			if r := recover(); r != nil {
				t.Fatalf("RegisterRoutes panicked alongside the foreign owners: %v", r)
			}
		}()
		newTestHandler(t).RegisterRoutes(api)
	}()

	if len(e.Routes()) != len(foreign)+len(wantRoutes()) {
		t.Fatalf("expected %d routes, got %d", len(foreign)+len(wantRoutes()), len(e.Routes()))
	}
	for _, f := range foreign {
		found := false
		for _, r := range e.Routes() {
			if r.Method == f.m && r.Path == "/api/v1"+f.p {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("foreign route %s /api/v1%s was stolen", f.m, f.p)
		}
	}
}
