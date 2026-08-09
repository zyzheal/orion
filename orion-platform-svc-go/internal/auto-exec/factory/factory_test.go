package factory

import (
	"context"
	"testing"
	"time"

	"orion/platform-svc-go/internal/auto-exec/models"
)

// mockPlugin is a test-only implementation of ExecutorPlugin.
type mockPlugin struct {
	name        string
	description string
	timeout     time.Duration
	executeFn   func(ctx context.Context, params map[string]interface{}) (*models.Result, error)
}

func (m *mockPlugin) Name() string          { return m.name }
func (m *mockPlugin) Description() string   { return m.description }
func (m *mockPlugin) DefaultTimeout() time.Duration { return m.timeout }
func (m *mockPlugin) Execute(ctx context.Context, params map[string]interface{}) (*models.Result, error) {
	return m.executeFn(ctx, params)
}
func (m *mockPlugin) Validate(params map[string]interface{}) error { return nil }

func TestNewExecutorFactory(t *testing.T) {
	f := NewExecutorFactory()
	if f == nil {
		t.Fatal("expected non-nil factory")
	}
}

func TestRegisterAndGet(t *testing.T) {
	f := NewExecutorFactory()
	p := &mockPlugin{name: "test", description: "test plugin", timeout: 10 * time.Second,
		executeFn: func(ctx context.Context, params map[string]interface{}) (*models.Result, error) {
			return &models.Result{ExitCode: 0}, nil
		}}

	if err := f.Register(p); err != nil {
		t.Fatalf("register failed: %v", err)
	}

	got, ok := f.Get("test")
	if !ok {
		t.Fatal("expected plugin to be found")
	}
	if got.Name() != "test" {
		t.Fatalf("expected name 'test', got %s", got.Name())
	}
}

func TestRegisterDuplicate(t *testing.T) {
	f := NewExecutorFactory()
	p := &mockPlugin{name: "dup", description: "x", timeout: time.Second,
		executeFn: func(ctx context.Context, params map[string]interface{}) (*models.Result, error) {
			return &models.Result{}, nil
		}}
	if err := f.Register(p); err != nil {
		t.Fatalf("first register failed: %v", err)
	}
	if err := f.Register(p); err == nil {
		t.Fatal("expected duplicate register error")
	}
}

func TestUnregister(t *testing.T) {
	f := NewExecutorFactory()
	p := &mockPlugin{name: "rm", description: "x", timeout: time.Second,
		executeFn: func(ctx context.Context, params map[string]interface{}) (*models.Result, error) {
			return &models.Result{}, nil
		}}
	f.Register(p)
	f.Unregister("rm")
	if _, ok := f.Get("rm"); ok {
		t.Fatal("expected plugin to be removed")
	}
}

func TestAllAndMetadata(t *testing.T) {
	f := NewExecutorFactory()
	f.Register(&mockPlugin{name: "a", description: "A", timeout: 10 * time.Second,
		executeFn: func(ctx context.Context, params map[string]interface{}) (*models.Result, error) {
			return &models.Result{}, nil
		}})
	f.Register(&mockPlugin{name: "b", description: "B", timeout: 20 * time.Second,
		executeFn: func(ctx context.Context, params map[string]interface{}) (*models.Result, error) {
			return &models.Result{}, nil
		}})
	if got := len(f.All()); got != 2 {
		t.Fatalf("expected 2 plugins, got %d", got)
	}
	md := f.Metadata()
	if len(md) != 2 {
		t.Fatalf("expected 2 metadata, got %d", len(md))
	}
}

func TestGlobalFactoryAutoRegistration(t *testing.T) {
	// The global factory registers 6 plugins via init(): shell, python, http, sql, webhook, pipeline-trigger.
	global := Factory()
	for _, name := range []string{"shell", "python", "http", "sql", "webhook", "pipeline-trigger"} {
		if _, ok := global.Get(name); !ok {
			t.Errorf("expected plugin %q to be auto-registered", name)
		}
	}
}
