package orchestrator

import (
	"context"
	"testing"

	"orion/workflow-svc-go/internal/workflow/engine/handler"
	"orion/workflow-svc-go/internal/workflow/models"
)

func TestNewEngine_DefaultFactory(t *testing.T) {
	e := NewEngine(EngineOptions{})
	if e.factory == nil {
		t.Fatal("expected factory to be initialized")
	}
	// GlobalFactory should have builtin handlers
	types := e.factory.List()
	if len(types) < 2 {
		t.Errorf("expected at least 2 builtin handlers, got %d", len(types))
	}
}

func TestEngine_ExecuteStep(t *testing.T) {
	factory := handler.NewStepHandlerFactory()
	factory.Register(&handler.AssigneeStepHandler{})

	e := NewEngine(EngineOptions{Factory: factory})
	ctx := context.Background()

	taskCtx := &handler.WorkflowTaskContext{
		TenantID:     "t-1",
		InstanceID:   "inst-1",
		NodeID:       "node-0",
		TaskID:       "task-0",
		StepConfig:   models.JSONB{"assignee": "user-1"},
		WorkflowData: models.JSONB{},
		Variables:    models.JSONB{},
	}

	result, err := e.ExecuteStep(ctx, taskCtx, "assignee", models.JSONB{})
	if err != nil {
		t.Fatalf("ExecuteStep returned error: %v", err)
	}
	if result == nil {
		t.Fatal("expected result")
	}
	if _, ok := result.Output["assignee"]; !ok {
		t.Error("expected assignee in output")
	}
}

func TestEngine_ExecuteStep_UnknownHandler(t *testing.T) {
	e := NewEngine(EngineOptions{})
	taskCtx := &handler.WorkflowTaskContext{}

	_, err := e.ExecuteStep(context.Background(), taskCtx, "unknown_type", models.JSONB{})
	if err == nil {
		t.Error("expected error for unknown handler")
	}
}

func TestEngine_ValidateFailure(t *testing.T) {
	// ActionStepHandler always returns nil for Validate, so we test that
	// Execute fails when actionType is missing
	e := NewEngine(EngineOptions{})
	taskCtx := &handler.WorkflowTaskContext{
		StepConfig:   models.JSONB{}, // no actionType
		WorkflowData: models.JSONB{},
	}
	_, err := e.ExecuteStep(context.Background(), taskCtx, "action", models.JSONB{})
	if err == nil {
		t.Error("expected validation error for missing actionType")
	}
}

func TestEngine_GetSLAMonitor(t *testing.T) {
	e := NewEngine(EngineOptions{})
	monitor := e.GetSLAMonitor()
	if monitor == nil {
		t.Fatal("expected SLAMonitor to be returned")
	}
}
