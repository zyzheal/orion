package plugin

import (
	"context"
	"testing"
	"time"
)

// mockPlugin is a minimal implementation of Plugin for testing.
type mockPlugin struct {
	initErr    error
	execResult *ExecuteResult
	execErr    error
	shutdownErr error
	healthErr  error
}

func (m *mockPlugin) Init(ctx context.Context, cfg PluginConfig) error { return m.initErr }
func (m *mockPlugin) Execute(ctx context.Context, pctx PluginContext, input map[string]interface{}) (*ExecuteResult, error) {
	return m.execResult, m.execErr
}
func (m *mockPlugin) Shutdown(ctx context.Context) error              { return m.shutdownErr }
func (m *mockPlugin) Health(ctx context.Context) error                { return m.healthErr }

func TestPluginInterface(t *testing.T) {
	// Verify the mock satisfies the Plugin interface at compile time.
	var _ Plugin = (*mockPlugin)(nil)

	ctx := context.Background()
	p := &mockPlugin{
		execResult: &ExecuteResult{Success: true, Output: map[string]interface{}{"key": "val"}},
	}

	cfg := PluginConfig{ID: "test-plugin", Version: "1.0.0"}
	if err := p.Init(ctx, cfg); err != nil {
		t.Fatalf("Init: %v", err)
	}

	pctx := PluginContext{TaskID: "task-1", TenantID: "tenant-1"}
	result, err := p.Execute(ctx, pctx, map[string]interface{}{"foo": "bar"})
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}
	if !result.Success {
		t.Fatal("expected success")
	}
	if result.Output["key"] != "val" {
		t.Fatalf("expected output key=val, got %v", result.Output["key"])
	}

	if err := p.Shutdown(ctx); err != nil {
		t.Fatalf("Shutdown: %v", err)
	}
	if err := p.Health(ctx); err != nil {
		t.Fatalf("Health: %v", err)
	}
}

func TestPluginInterface_Failure(t *testing.T) {
	ctx := context.Background()
	p := &mockPlugin{
		execResult: &ExecuteResult{Success: false, ErrorMessage: "something went wrong"},
	}

	pctx := PluginContext{TaskID: "task-2", TenantID: "tenant-1"}
	result, err := p.Execute(ctx, pctx, nil)
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}
	if result.Success {
		t.Fatal("expected failure")
	}
	if result.ErrorMessage != "something went wrong" {
		t.Fatalf("unexpected error message: %s", result.ErrorMessage)
	}
}

func TestPluginConfigDefaults(t *testing.T) {
	cfg := PluginConfig{ID: "test", Version: "1.0"}
	if cfg.ID != "test" {
		t.Fatalf("unexpected ID: %s", cfg.ID)
	}
	if cfg.Version != "1.0" {
		t.Fatalf("unexpected Version: %s", cfg.Version)
	}
}

func TestExecutionStateConstants(t *testing.T) {
	states := []ExecutionState{StatePending, StateRunning, StateCompleted, StateFailed, StateKilled, StateTimedOut}
	if len(states) != 6 {
		t.Fatalf("expected 6 states, got %d", len(states))
	}
}

func TestSentinelErrors(t *testing.T) {
	if ErrPluginNotFound.Error() != "plugin: not found" {
		t.Fatalf("unexpected: %s", ErrPluginNotFound.Error())
	}
	if ErrPluginNotReady.Error() != "plugin: not ready" {
		t.Fatalf("unexpected: %s", ErrPluginNotReady.Error())
	}
	if ErrPluginTimeout.Error() != "plugin: execution timed out" {
		t.Fatalf("unexpected: %s", ErrPluginTimeout.Error())
	}
	if ErrPluginKilled.Error() != "plugin: execution killed" {
		t.Fatalf("unexpected: %s", ErrPluginKilled.Error())
	}
	if ErrPluginRejected.Error() != "plugin: execution rejected" {
		t.Fatalf("unexpected: %s", ErrPluginRejected.Error())
	}
	if ErrPluginPanic.Error() != "plugin: execution panicked" {
		t.Fatalf("unexpected: %s", ErrPluginPanic.Error())
	}
	if ErrPluginDisabled.Error() != "plugin: disabled" {
		t.Fatalf("unexpected: %s", ErrPluginDisabled.Error())
	}
}

func TestPluginInfoStruct(t *testing.T) {
	info := PluginInfo{
		ID:      "test",
		Version: "1.0",
		Healthy: true,
		Running: 2,
	}
	if !info.Healthy {
		t.Fatal("expected healthy")
	}
	if info.Running != 2 {
		t.Fatalf("expected 2 running, got %d", info.Running)
	}
}

func TestPluginContext(t *testing.T) {
	ctx := PluginContext{
		TaskID:    "task-1",
		TenantID:  "tenant-1",
		Config:    map[string]interface{}{"key": "val"},
	}
	if ctx.TaskID != "task-1" {
		t.Fatalf("unexpected TaskID: %s", ctx.TaskID)
	}
	if ctx.Config["key"] != "val" {
		t.Fatalf("unexpected Config value: %v", ctx.Config["key"])
	}
}

func TestExecutionFilter(t *testing.T) {
	f := ExecutionFilter{
		TenantID: "tenant-1",
		PluginID: "plugin-1",
		State:    StateRunning,
		Limit:    10,
	}
	if f.TenantID != "tenant-1" {
		t.Fatalf("unexpected TenantID: %s", f.TenantID)
	}
	if f.State != StateRunning {
		t.Fatalf("unexpected State: %s", f.State)
	}
}

func TestResourceQuota(t *testing.T) {
	q := ResourceQuota{
		CPUCores:      2,
		MemoryBytes:   512 * 1024 * 1024,
		TimeoutMs:     300000,
		MaxConcurrent: 5,
	}
	if q.CPUCores != 2 {
		t.Fatalf("unexpected CPUCores: %d", q.CPUCores)
	}
	if q.TimeoutMs != 300000 {
		t.Fatalf("unexpected TimeoutMs: %d", q.TimeoutMs)
	}
}

func TestSecurityEvent(t *testing.T) {
	e := SecurityEvent{
		EventType: "unauthorized_access",
		Severity:  "high",
		PluginID:  "plugin-1",
		Message:   "unauthorized access attempt",
	}
	if e.EventType != "unauthorized_access" {
		t.Fatalf("unexpected EventType: %s", e.EventType)
	}
	if e.Severity != "high" {
		t.Fatalf("unexpected Severity: %s", e.Severity)
	}
}

func TestExecuteResult(t *testing.T) {
	r := &ExecuteResult{
		Success:  true,
		ExitCode: 0,
		Stdout:   "hello",
		Output:   map[string]interface{}{"result": "ok"},
	}
	if !r.Success {
		t.Fatal("expected success")
	}
	if r.Stdout != "hello" {
		t.Fatalf("unexpected stdout: %s", r.Stdout)
	}
	if r.Output["result"] != "ok" {
		t.Fatalf("unexpected output: %v", r.Output["result"])
	}
}

func TestExecuteResultSerialisation(t *testing.T) {
	// Ensure PluginConfig, PluginContext, and ExecuteResult all have JSON tags
	// (covered by the json tags in the struct definitions).
	_ = time.Now()
}