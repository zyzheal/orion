package engine

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/auto-exec/interfaces"
	"orion/platform-svc-go/internal/auto-exec/models"
)

// stubResultPlugin returns whatever result it was constructed with. It exists so
// the adapter's success/failure decision can be exercised in isolation from the
// real process plugins, which shell out.
type stubResultPlugin struct {
	result *models.Result
	err    error
	got    map[string]interface{}
}

func (s *stubResultPlugin) Name() string                                 { return "stub" }
func (s *stubResultPlugin) Description() string                          { return "stub" }
func (s *stubResultPlugin) DefaultTimeout() time.Duration                { return time.Minute }
func (s *stubResultPlugin) Validate(params map[string]interface{}) error { return nil }
func (s *stubResultPlugin) Execute(ctx context.Context, params map[string]interface{}) (*models.Result, error) {
	s.got = params
	return s.result, s.err
}

// A plugin that signals failure only through ExitCode is a failure. Before the
// fix this adapter ignored ExitCode entirely and reported completion.
func TestExecutorPluginAdapterFailsOnNonZeroExitCode(t *testing.T) {
	a := &executorPluginAdapter{plugin: &stubResultPlugin{
		result: &models.Result{ExitCode: 7, Stdout: "partial output"},
	}}

	out, err := a.Execute(context.Background(), map[string]string{"arg": "v"}, nil)
	if err == nil {
		t.Fatalf("expected error for exit code 7, got nil; out=%q", out)
	}
	if !strings.Contains(err.Error(), "stub") || !strings.Contains(err.Error(), "7") {
		t.Fatalf("error = %q, want it to name the plugin and the exit code", err.Error())
	}
	if !strings.Contains(out, "partial output") {
		t.Fatalf("out = %q, want the plugin stdout preserved", out)
	}
}

func TestExecutorPluginAdapterSucceedsOnZeroExitCode(t *testing.T) {
	a := &executorPluginAdapter{plugin: &stubResultPlugin{
		result: &models.Result{ExitCode: 0, Stdout: "hello", Stderr: "warn"},
	}}

	out, err := a.Execute(context.Background(), map[string]string{}, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(out, "hello") || !strings.Contains(out, "warn") {
		t.Fatalf("out = %q, want stdout and stderr rendered", out)
	}
}

func TestExecutorPluginAdapterWrapsPluginError(t *testing.T) {
	a := &executorPluginAdapter{plugin: &stubResultPlugin{
		result: &models.Result{ExitCode: 1, ErrorMessage: "kaboom"},
		err:    errors.New("kaboom"),
	}}

	out, err := a.Execute(context.Background(), map[string]string{}, nil)
	if err == nil {
		t.Fatal("expected the plugin error to propagate")
	}
	if !strings.Contains(err.Error(), "kaboom") {
		t.Fatalf("error = %q, want it to wrap the plugin error", err.Error())
	}
	if !strings.Contains(out, "error: kaboom") {
		t.Fatalf("out = %q, want the ErrorMessage rendered", out)
	}
}

// nil result is not a panic site: error case returns it, success case renders "".
func TestExecutorPluginAdapterHandlesNilResult(t *testing.T) {
	a := &executorPluginAdapter{plugin: &stubResultPlugin{result: nil, err: errors.New("nil result")}}
	if _, err := a.Execute(context.Background(), map[string]string{}, nil); err == nil {
		t.Fatal("expected error when the plugin returns a nil result and an error")
	}

	a = &executorPluginAdapter{plugin: &stubResultPlugin{result: nil, err: nil}}
	out, err := a.Execute(context.Background(), map[string]string{}, nil)
	if err != nil || out != "" {
		t.Fatalf("nil result without error: got out=%q err=%v, want empty and nil", out, err)
	}
}

// Params arrive as map[string]string and must be passed through as
// map[string]interface{} intact.
func TestExecutorPluginAdapterForwardsParams(t *testing.T) {
	a := &executorPluginAdapter{plugin: &stubResultPlugin{result: &models.Result{}}}
	_, err := a.Execute(context.Background(), map[string]string{"url": "https://x", "n": "3"}, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := a.plugin.(*stubResultPlugin).got["url"]; got != "https://x" {
		t.Fatalf("url = %v, want https://x", got)
	}
	if got := a.plugin.(*stubResultPlugin).got["n"]; got != "3" {
		t.Fatalf("n = %v, want 3", got)
	}
}

func TestExecutorPluginAdapterCategory(t *testing.T) {
	for _, tc := range []struct{ name, want string }{
		{"shell", "process"}, {"python", "process"}, {"http", "network"},
		{"webhook", "integration"}, {"pipeline-trigger", "pipeline"}, {"elsewhere", "custom"},
	} {
		p := &stubResultPlugin{}
		_ = p
		a := &executorPluginAdapter{plugin: namedStub{tc.name}}
		if got := a.Category(); got != tc.want {
			t.Errorf("Category(%q) = %q, want %q", tc.name, got, tc.want)
		}
		if got := a.Name(); got != tc.name {
			t.Errorf("Name() = %q, want %q", got, tc.name)
		}
	}
}

type namedStub struct{ name string }

func (n namedStub) Name() string                                 { return n.name }
func (n namedStub) Description() string                          { return n.name }
func (n namedStub) DefaultTimeout() time.Duration                { return time.Minute }
func (n namedStub) Validate(params map[string]interface{}) error { return nil }
func (n namedStub) Execute(ctx context.Context, params map[string]interface{}) (*models.Result, error) {
	return nil, nil
}

var _ interfaces.ExecutorPlugin = (*stubResultPlugin)(nil)
var _ interfaces.ExecutorPlugin = namedStub{}
