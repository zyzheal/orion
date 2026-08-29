package service

import (
	"context"
	"errors"
	"sync"
	"testing"

	"go.uber.org/zap"
	"orion/platform-svc-go/internal/pipeline-executor/models"
)

// mockStepHandler implements StepHandler for testing.
type mockStepHandler struct {
	name   string
	stype  string
	called bool
	input  []byte
	config map[string]string
	err    error
	output []byte
}

func (h *mockStepHandler) Name() string { return h.name }
func (h *mockStepHandler) Type() string { return h.stype }
func (h *mockStepHandler) Process(input []byte, config map[string]string) ([]byte, error) {
	h.called = true
	h.input = input
	h.config = config
	return h.output, h.err
}

func Test_NewExecutor_NilDeps(t *testing.T) {
	exec := NewExecutor(nil, nil)
	if exec == nil {
		t.Fatal("expected non-nil executor")
	}
	if exec.repo != nil {
		t.Fatal("expected nil repo")
	}
	if exec.steps == nil {
		t.Fatal("expected non-nil steps map")
	}
	if len(exec.steps) != 0 {
		t.Fatalf("expected empty steps, got %d", len(exec.steps))
	}
}

func Test_NewExecutor_WithLogger(t *testing.T) {
	logger := zap.NewNop()
	exec := NewExecutor(nil, logger)
	if exec == nil {
		t.Fatal("expected non-nil executor")
	}
	if exec.logger != logger {
		t.Fatal("expected the provided logger")
	}
}

func Test_NewExecutor_NilLogger(t *testing.T) {
	exec := NewExecutor(nil, nil)
	if exec == nil {
		t.Fatal("expected non-nil executor")
	}
	// nil logger should not panic when we just constructed it
}

func Test_RegisterStep_Single(t *testing.T) {
	exec := NewExecutor(nil, zap.NewNop())
	h := &mockStepHandler{name: "TestHandler", stype: "filter"}
	exec.RegisterStep(h)
	if len(exec.steps) != 1 {
		t.Fatalf("expected 1 step, got %d", len(exec.steps))
	}
	step, ok := exec.steps["filter"]
	if !ok {
		t.Fatal("expected step registered under 'filter'")
	}
	if step.Name() != "TestHandler" {
		t.Fatalf("expected 'TestHandler', got '%s'", step.Name())
	}
}

func Test_RegisterStep_Overwrite(t *testing.T) {
	exec := NewExecutor(nil, zap.NewNop())
	h1 := &mockStepHandler{name: "Handler1", stype: "filter"}
	h2 := &mockStepHandler{name: "Handler2", stype: "filter"}
	exec.RegisterStep(h1)
	exec.RegisterStep(h2)
	if len(exec.steps) != 1 {
		t.Fatalf("expected 1 step after overwrite, got %d", len(exec.steps))
	}
	if exec.steps["filter"].Name() != "Handler2" {
		t.Fatalf("expected 'Handler2' after overwrite, got '%s'", exec.steps["filter"].Name())
	}
}

func Test_RegisterStep_MultipleTypes(t *testing.T) {
	exec := NewExecutor(nil, zap.NewNop())
	exec.RegisterStep(&mockStepHandler{name: "Filter", stype: "filter"})
	exec.RegisterStep(&mockStepHandler{name: "Transform", stype: "transform"})
	exec.RegisterStep(&mockStepHandler{name: "Notify", stype: "notify"})
	if len(exec.steps) != 3 {
		t.Fatalf("expected 3 steps, got %d", len(exec.steps))
	}
}

func Test_getStepHandler_Found(t *testing.T) {
	exec := NewExecutor(nil, zap.NewNop())
	h := &mockStepHandler{name: "Test", stype: "filter"}
	exec.RegisterStep(h)
	found, ok := exec.getStepHandler("filter")
	if !ok {
		t.Fatal("expected step to be found")
	}
	if found.Name() != "Test" {
		t.Fatalf("expected 'Test', got '%s'", found.Name())
	}
}

func Test_getStepHandler_NotFound(t *testing.T) {
	exec := NewExecutor(nil, nil)
	_, ok := exec.getStepHandler("nonexistent")
	if ok {
		t.Fatal("expected step NOT to be found")
	}
}

func Test_getStepHandler_ConcurrentAccess(t *testing.T) {
	exec := NewExecutor(nil, zap.NewNop())
	h := &mockStepHandler{name: "Test", stype: "filter"}
	exec.RegisterStep(h)

	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, ok := exec.getStepHandler("filter")
			if !ok {
				t.Error("expected step to be found under concurrent read")
			}
		}()
	}
	wg.Wait()
}

func Test_GetPipeline_NilRepo(t *testing.T) {
	exec := NewExecutor(nil, nil)
	defer func() {
		if r := recover(); r != nil {
			t.Log("GetPipeline with nil repo panicked as expected")
		}
	}()
	exec.GetPipeline(context.Background(), "tenant", "pipeline-1")
}

func Test_Errors(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want string
	}{
		{"StepHandlerNotRegistered", ErrStepHandlerNotRegistered, "step handler not registered"},
		{"PipelineDisabled", ErrPipelineDisabled, "pipeline is disabled"},
		{"NoSteps", ErrNoSteps, "pipeline has no steps"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.err == nil {
				t.Fatal("expected non-nil error")
			}
			if tt.err.Error() != tt.want {
				t.Fatalf("expected '%s', got '%s'", tt.want, tt.err.Error())
			}
		})
	}
}

func Test_ModelConstants(t *testing.T) {
	if models.PipelineStatusActive != "active" {
		t.Fatalf("expected PipelineStatusActive='active', got '%s'", models.PipelineStatusActive)
	}
	if models.PipelineStatusDisabled != "disabled" {
		t.Fatalf("expected PipelineStatusDisabled='disabled', got '%s'", models.PipelineStatusDisabled)
	}
	if models.StepStatusReady != "ready" {
		t.Fatalf("expected StepStatusReady='ready', got '%s'", models.StepStatusReady)
	}
	if models.StepStatusError != "error" {
		t.Fatalf("expected StepStatusError='error', got '%s'", models.StepStatusError)
	}
	if models.ExecStatusRunning != "running" {
		t.Fatalf("expected ExecStatusRunning='running', got '%s'", models.ExecStatusRunning)
	}
	if models.ExecStatusCompleted != "completed" {
		t.Fatalf("expected ExecStatusCompleted='completed', got '%s'", models.ExecStatusCompleted)
	}
	if models.ExecStatusFailed != "failed" {
		t.Fatalf("expected ExecStatusFailed='failed', got '%s'", models.ExecStatusFailed)
	}
}

func Test_ModelStepTypes(t *testing.T) {
	if models.StepTypeFilter != "filter" {
		t.Fatalf("expected StepTypeFilter='filter', got '%s'", models.StepTypeFilter)
	}
	if models.StepTypeTransform != "transform" {
		t.Fatalf("expected StepTypeTransform='transform', got '%s'", models.StepTypeTransform)
	}
	if models.StepTypeNotify != "notify" {
		t.Fatalf("expected StepTypeNotify='notify', got '%s'", models.StepTypeNotify)
	}
	if models.StepTypeAction != "action" {
		t.Fatalf("expected StepTypeAction='action', got '%s'", models.StepTypeAction)
	}
	if models.StepTypeCondition != "condition" {
		t.Fatalf("expected StepTypeCondition='condition', got '%s'", models.StepTypeCondition)
	}
}

func Test_ModelCategories(t *testing.T) {
	if models.CategoryAlert != "alert" {
		t.Fatalf("expected CategoryAlert='alert', got '%s'", models.CategoryAlert)
	}
	if models.CategoryNotification != "notification" {
		t.Fatalf("expected CategoryNotification='notification', got '%s'", models.CategoryNotification)
	}
	if models.CategoryWebhook != "webhook" {
		t.Fatalf("expected CategoryWebhook='webhook', got '%s'", models.CategoryWebhook)
	}
	if models.CategoryAutomation != "automation" {
		t.Fatalf("expected CategoryAutomation='automation', got '%s'", models.CategoryAutomation)
	}
}

func Test_errorsIs(t *testing.T) {
	if !errors.Is(ErrStepHandlerNotRegistered, ErrStepHandlerNotRegistered) {
		t.Fatal("expected errors.Is to match")
	}
	if errors.Is(ErrStepHandlerNotRegistered, ErrPipelineDisabled) {
		t.Fatal("expected errors.Is to NOT match different errors")
	}
}
