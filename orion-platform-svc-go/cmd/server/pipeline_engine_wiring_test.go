package main

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// A pipeline-engine handler must never be built on a zero-value PipelineEngine.
//
// The zero value has a nil repository, so its GetRun/ListRuns/GetStages/GetTasks
// all dereference that nil and panic inside an HTTP handler. The wiring
// regression that introduced this was invisible to `go build` and `go vet` and
// showed up only as 500s on every /pipeline-engine route, with six routes
// affected. This test drives the real initWiring path and then calls one of
// those handlers; the failing stub DB returns an error that the handler turns
// into a 404, which is the only outcome a properly wired engine produces.
func TestPipelineEngineHandlerIsFullyWired(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("JWT_SECRET", "test-secret")
	t.Setenv("REDIS_ADDR", "localhost:6379")
	t.Setenv("DB_USER", "postgres")
	t.Setenv("DB_PASSWORD", "postgres")

	logger := zap.NewNop()
	initWiring(stubInfrastructure(logger), logger)

	if peH == nil {
		t.Fatal("peH is nil: /pipeline-engine routes are unmounted")
	}

	// A zero-value engine panics here; a wired engine reaches the stub DB and
	// returns "stub db: query disabled", which the handler maps to a 404.
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/pipeline-engine/runs/r1", nil)
	c.Set("tenant_id", "t1")
	c.Params = gin.Params{{Key: "runId", Value: "r1"}}

	peH.GetRun(c)

	if w.Code != http.StatusNotFound {
		t.Fatalf("GetRun status = %d, want 404 from the stub DB: a different status means peH is not backed by a real engine\nbody: %s",
			w.Code, w.Body.String())
	}
}
