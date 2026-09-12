package main

import (
	"context"
	"strings"
	"testing"

	"go.uber.org/zap"

	auto_exec_plugins "orion/platform-svc-go/internal/auto-exec/plugins"
)

// The auto-exec engine starts with an empty plugin registry, and the factory's
// init() populated a *different* registry that nothing read. So every task run
// failed with "plugin not registered" and CreateTask rejected every plugin name.
// Both of those facts are invisible to `go build` and `go vet`: the code compiles
// and nothing at startup complains about an empty registry.
func TestAutoExecEngineRegistersBundledPlugins(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")
	t.Setenv("REDIS_ADDR", "localhost:6379")
	t.Setenv("DB_USER", "postgres")
	t.Setenv("DB_PASSWORD", "postgres")

	logger := zap.NewNop()
	initWiring(stubInfrastructure(logger), logger)

	if autoExecEng == nil {
		t.Fatal("autoExecEng is nil: wireAutoExec did not construct an engine")
	}
	if autoExecH == nil {
		t.Fatal("autoExecH is nil: auto-exec routes are unmounted")
	}

	have := map[string]bool{}
	for _, p := range autoExecEng.ListPlugins() {
		have[p.Name] = true
	}
	for _, want := range []string{"shell", "python", "http", "webhook", "pipeline-trigger"} {
		if !have[want] {
			t.Errorf("engine plugin registry is missing %q; got %v", want, keys(have))
		}
	}
	if len(have) < 5 {
		t.Fatalf("expected at least 5 registered plugins, got %d: %v", len(have), keys(have))
	}
}

// pipeline-trigger used to be shipped with a DefaultPipelineRunner that returned
// status "stubbed" and a nil error, i.e. a successful task for a pipeline that
// never ran. That runner is gone, so a trigger now reaches the real pipeline
// engine. Either outcome below is a failure — only a genuine engine-level error
// proves the wiring is real.
func TestAutoExecPipelineRunnerIsReal(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")
	t.Setenv("REDIS_ADDR", "localhost:6379")
	t.Setenv("DB_USER", "postgres")
	t.Setenv("DB_PASSWORD", "postgres")

	logger := zap.NewNop()
	initWiring(stubInfrastructure(logger), logger)

	if auto_exec_plugins.GetTriggerPipelineRunner() == nil {
		t.Fatal("trigger pipeline runner is nil: pipeline-trigger cannot trigger anything")
	}

	res, err := auto_exec_plugins.TriggerPipeline(
		context.Background(), "does-not-exist", map[string]interface{}{})
	if err == nil {
		t.Fatalf("expected an error for a nonexistent pipeline, got a success with status %q",
			statusOf(res))
	}
	if res != nil && res.Status == "stubbed" {
		t.Fatal("runner is still returning the stub sentinel status")
	}
	if !strings.Contains(err.Error(), "does-not-exist") {
		t.Fatalf("error = %q, want it to come from the real pipeline engine and name the pipeline",
			err.Error())
	}
}

func statusOf(r *auto_exec_plugins.PipelineRunResult) string {
	if r == nil {
		return "<nil>"
	}
	return r.Status
}

func keys(m map[string]bool) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}
