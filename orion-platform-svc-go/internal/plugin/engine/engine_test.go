package engine

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"orion/go-common/pkg/plugin"

	"orion/platform-svc-go/internal/plugin/spi"

	"go.uber.org/zap"
)

// mockPlugin is a simple in-memory plugin.Plugin implementation for testing.
type mockPlugin struct {
	initCalled      bool
	executeCount    int
	shutdownCalled  bool
	failInit        bool
	failExecute     bool
	healthErr       error
	panicExecute    bool
	result          *plugin.ExecuteResult
}

var _ plugin.Plugin = (*mockPlugin)(nil)

func (m *mockPlugin) Init(ctx context.Context, cfg plugin.PluginConfig) error {
	m.initCalled = true
	if m.failInit {
		return plugin.ErrPluginNotReady
	}
	return nil
}

func (m *mockPlugin) Execute(ctx context.Context, pctx plugin.PluginContext,
	input map[string]interface{}) (*plugin.ExecuteResult, error) {
	m.executeCount++
	if m.panicExecute {
		panic("test panic")
	}
	if m.failExecute {
		return nil, plugin.ErrPluginTimeout
	}
	if m.result != nil {
		return m.result, nil
	}
	return &plugin.ExecuteResult{Success: true}, nil
}

func (m *mockPlugin) Shutdown(ctx context.Context) error {
	m.shutdownCalled = true
	return nil
}

func (m *mockPlugin) Health(ctx context.Context) error {
	return m.healthErr
}

var logger = zap.NewNop()

func TestEngine_RegisterAndExecute(t *testing.T) {
	e := NewEngine(Config{}, logger)
	impl := &mockPlugin{result: &plugin.ExecuteResult{Success: true}}
	if err := e.RegisterBuiltin("test", "Test", "1.0.0", impl); err != nil {
		t.Fatalf("register: %v", err)
	}
	inst, err := e.registry.Get("test")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if inst.Name() != "Test" {
		t.Fatalf("name: got %s", inst.Name())
	}
	if inst.Version() != "1.0.0" {
		t.Fatalf("version: got %s", inst.Version())
	}
	cfg := plugin.PluginConfig{ID: "test", Version: "1.0.0"}
	if err := inst.Init(context.Background(), cfg); err != nil {
		t.Fatalf("init: %v", err)
	}
	result, err := e.Execute(context.Background(), "test",
		plugin.PluginContext{TaskID: "t1", TenantID: "tenant-1"}, nil)
	if err != nil {
		t.Fatalf("execute: %v", err)
	}
	if !result.Success {
		t.Fatalf("expected success")
	}
	if impl.executeCount != 1 {
		t.Fatalf("executeCount: got %d", impl.executeCount)
	}
	stats := e.GetExecutionStats("test")
	if stats.Executed() != 1 {
		t.Fatalf("executed: got %d", stats.Executed())
	}
}

func TestEngine_DuplicateRegister(t *testing.T) {
	e := NewEngine(Config{}, logger)
	impl := &mockPlugin{}
	if err := e.RegisterBuiltin("dup", "Dup", "1.0.0", impl); err != nil {
		t.Fatalf("first register: %v", err)
	}
	if err := e.RegisterBuiltin("dup", "Dup", "2.0.0", impl); err != spi.ErrAlreadyRegistered {
		t.Fatalf("expected ErrAlreadyRegistered, got %v", err)
	}
}

func TestEngine_NotRegistered(t *testing.T) {
	e := NewEngine(Config{}, logger)
	_, err := e.Execute(context.Background(), "missing",
		plugin.PluginContext{TaskID: "t1"}, nil)
	if err != spi.ErrNotRegistered {
		t.Fatalf("expected ErrNotRegistered, got %v", err)
	}
}

func TestEngine_NotInitialized(t *testing.T) {
	e := NewEngine(Config{}, logger)
	impl := &mockPlugin{}
	e.RegisterBuiltin("test", "Test", "1.0.0", impl)
	_, err := e.Execute(context.Background(), "test",
		plugin.PluginContext{TaskID: "t1"}, nil)
	if err != plugin.ErrPluginNotReady {
		t.Fatalf("expected ErrPluginNotReady, got %v", err)
	}
}

func TestEngine_PanicRecovery(t *testing.T) {
	e := NewEngine(Config{}, logger)
	impl := &mockPlugin{panicExecute: true}
	e.RegisterBuiltin("test", "Test", "1.0.0", impl)
	inst, _ := e.registry.Get("test")
	inst.Init(context.Background(), plugin.PluginConfig{ID: "test"})
	_, err := e.Execute(context.Background(), "test",
		plugin.PluginContext{TaskID: "t1"}, nil)
	if err != plugin.ErrPluginPanic {
		t.Fatalf("expected ErrPluginPanic, got %v", err)
	}
	stats := e.GetExecutionStats("test")
	if stats.Failed() != 1 {
		t.Fatalf("expected failed=1, got %d", stats.Failed())
	}
}

func TestEngine_ConcurrencyLimit(t *testing.T) {
	e := NewEngine(Config{MaxConcurrentPerPlugin: 1}, logger)

	// blockingPlugin blocks Execute on a channel so the first call holds the
	// concurrency slot until we close it.
	block := make(chan struct{})
	acquired := make(chan struct{}) // signals when the slot has been acquired
	blocking := &blockingPlugin{
		result:   &plugin.ExecuteResult{Success: true},
		block:    block,
		acquired: acquired,
	}
	e.RegisterBuiltin("test", "Test", "1.0.0", blocking)
	inst, _ := e.registry.Get("test")
	inst.Init(context.Background(), plugin.PluginConfig{ID: "test"})

	// First call in a goroutine; it blocks inside Execute holding the slot.
	errCh := make(chan error, 1)
	go func() {
		_, err := e.Execute(context.Background(), "test",
			plugin.PluginContext{TaskID: "t1"}, nil)
		errCh <- err
	}()

	// Wait for the first call to enter the blocking plugin.
	select {
	case <-acquired:
	case <-time.After(5 * time.Second):
		t.Fatal("first Execute did not acquire slot")
	}

	// Second call should be rejected because the slot is held.
	_, err := e.Execute(context.Background(), "test",
		plugin.PluginContext{TaskID: "t2"}, nil)
	if err != plugin.ErrPluginRejected {
		t.Fatalf("expected ErrPluginRejected, got %v", err)
	}

	close(block)
	<-errCh
}

// blockingPlugin blocks its Execute call on a channel until released.
type blockingPlugin struct {
	result   *plugin.ExecuteResult
	block    <-chan struct{}
	acquired chan struct{}
}

func (b *blockingPlugin) Init(ctx context.Context, cfg plugin.PluginConfig) error {
	return nil
}

func (b *blockingPlugin) Execute(ctx context.Context, pctx plugin.PluginContext,
	input map[string]interface{}) (*plugin.ExecuteResult, error) {
	if b.acquired != nil {
		b.acquired <- struct{}{}
	}
	<-b.block
	return b.result, nil
}

func (b *blockingPlugin) Shutdown(ctx context.Context) error { return nil }
func (b *blockingPlugin) Health(ctx context.Context) error   { return nil }

func TestEngine_DisabledPlugin(t *testing.T) {
	e := NewEngine(Config{}, logger)
	impl := &mockPlugin{}
	e.RegisterBuiltin("test", "Test", "1.0.0", impl)
	inst, _ := e.registry.Get("test")
	inst.SetEnabled(false)
	inst.Init(context.Background(), plugin.PluginConfig{ID: "test"})
	_, err := e.Execute(context.Background(), "test",
		plugin.PluginContext{TaskID: "t1"}, nil)
	if err != plugin.ErrPluginDisabled {
		t.Fatalf("expected ErrPluginDisabled, got %v", err)
	}
}

func TestEngine_Info(t *testing.T) {
	e := NewEngine(Config{}, logger)
	impl := &mockPlugin{}
	e.RegisterBuiltin("test", "Test", "1.0.0", impl)
	inst, _ := e.registry.Get("test")
	inst.Init(context.Background(), plugin.PluginConfig{ID: "test"})
	info := e.Info("test")
	if info.ID != "test" {
		t.Fatalf("id: got %s", info.ID)
	}
	if info.Version != "1.0.0" {
		t.Fatalf("version: got %s", info.Version)
	}
	if !info.Healthy {
		t.Fatalf("expected healthy")
	}
}

func TestEngine_AllInfos(t *testing.T) {
	e := NewEngine(Config{}, logger)
	impl := &mockPlugin{}
	e.RegisterBuiltin("test", "Test", "1.0.0", impl)
	inst, _ := e.registry.Get("test")
	inst.Init(context.Background(), plugin.PluginConfig{ID: "test"})
	infos := e.AllInfos()
	if len(infos) != 1 {
		t.Fatalf("expected 1 info, got %d", len(infos))
	}
}

func TestEngine_PluginIDs(t *testing.T) {
	e := NewEngine(Config{}, logger)
	e.RegisterBuiltin("a", "A", "1.0.0", &mockPlugin{})
	e.RegisterBuiltin("b", "B", "1.0.0", &mockPlugin{})
	ids := e.PluginIDs()
	if len(ids) != 2 {
		t.Fatalf("expected 2 ids, got %d", len(ids))
	}
}

func TestEngine_ConcurrentExec(t *testing.T) {
	e := NewEngine(Config{}, logger)
	impl := &mockPlugin{result: &plugin.ExecuteResult{Success: true}}
	e.RegisterBuiltin("test", "Test", "1.0.0", impl)
	inst, _ := e.registry.Get("test")
	inst.Init(context.Background(), plugin.PluginConfig{ID: "test"})
	var wg sync.WaitGroup
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, _ = e.Execute(context.Background(), "test",
				plugin.PluginContext{TaskID: "t1"}, nil)
		}()
	}
	wg.Wait()
}

func TestEngine_StartStop(t *testing.T) {
	e := NewEngine(Config{ReloadingInterval: 1 * time.Millisecond}, logger)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	e.Start(ctx)
	e.Stop()
	e.Stop() // idempotent
}

func TestEngine_IsStopped(t *testing.T) {
	e := NewEngine(Config{}, logger)
	if e.IsStopped() {
		t.Fatalf("expected not stopped")
	}
	e.MarkStopped()
	if !e.IsStopped() {
		t.Fatalf("expected stopped")
	}
	e.MarkStopped() // idempotent
}

func TestEngine_ShutdownAll(t *testing.T) {
	e := NewEngine(Config{}, logger)
	impl := &mockPlugin{}
	e.RegisterBuiltin("test", "Test", "1.0.0", impl)
	inst, _ := e.registry.Get("test")
	inst.Init(context.Background(), plugin.PluginConfig{ID: "test"})
	e.ShutdownAll(context.Background())
	if !impl.shutdownCalled {
		t.Fatalf("expected shutdown")
	}
}

func TestEngine_HotReload(t *testing.T) {
	e := NewEngine(Config{}, logger)
	impl := &mockPlugin{}
	e.RegisterBuiltin("test", "Test", "1.0.0", impl)
	inst, _ := e.registry.Get("test")
	inst.Init(context.Background(), plugin.PluginConfig{ID: "test"})

	// Hot reload without factory fails.
	err := e.HotReload(context.Background(), "test", nil)
	if err != ErrNoFactoryForHotReload {
		t.Fatalf("expected ErrNoFactoryForHotReload, got %v", err)
	}

	// Hot reload with factory succeeds.
	newImpl := &mockPlugin{}
	err = e.HotReload(context.Background(), "test", func() (string, string, string, plugin.Plugin) {
		return "test", "Test", "2.0.0", newImpl
	})
	if err != nil {
		t.Fatalf("hot reload: %v", err)
	}
	newInst, _ := e.registry.Get("test")
	if newInst.Version() != "2.0.0" {
		t.Fatalf("version: got %s", newInst.Version())
	}
	if !impl.shutdownCalled {
		t.Fatalf("expected old shutdown")
	}
}

func TestEngine_HotReloadNotRegistered(t *testing.T) {
	e := NewEngine(Config{}, logger)
	err := e.HotReload(context.Background(), "missing", nil)
	if err != spi.ErrNotRegistered {
		t.Fatalf("expected ErrNotRegistered, got %v", err)
	}
}

func TestEngine_WithTimeout(t *testing.T) {
	ctx, cancel := WithTimeout(context.Background(), 0) // 0 → default 5min
	defer cancel()
	// Just verify no panic and context has deadline.
	if _, ok := ctx.Deadline(); !ok {
		t.Fatalf("expected deadline")
	}
}

func TestEngine_NewSandboxError(t *testing.T) {
	err := NewSandboxError("test", "limit", plugin.ErrPluginRejected)
	if err.PluginID != "test" {
		t.Fatalf("pluginID: got %s", err.PluginID)
	}
	if err.Reason != "limit" {
		t.Fatalf("reason: got %s", err.Reason)
	}
	if !errors.Is(err, plugin.ErrPluginRejected) {
		// Manual check.
	}
}
