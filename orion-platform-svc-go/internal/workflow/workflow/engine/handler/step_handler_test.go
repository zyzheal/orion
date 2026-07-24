package handler

import (
	"context"
	"testing"

	"orion/platform-svc-go/internal/workflow/workflow/models"
)

func TestStepHandlerFactory_RegisterAndGet(t *testing.T) {
	factory := NewStepHandlerFactory()
	factory.Register(&AssigneeStepHandler{})

	h, ok := factory.Get("assignee")
	if !ok {
		t.Fatal("expected assignee handler to be found")
	}
	if h.Type() != "assignee" {
		t.Errorf("expected type assignee, got %s", h.Type())
	}
}

func TestStepHandlerFactory_RegisterDuplicatePanics(t *testing.T) {
	factory := NewStepHandlerFactory()
	factory.Register(&AssigneeStepHandler{})

	defer func() {
		if r := recover(); r == nil {
			t.Fatal("expected panic on duplicate registration")
		}
	}()
	factory.Register(&AssigneeStepHandler{})
}

func TestStepHandlerFactory_List(t *testing.T) {
	factory := NewStepHandlerFactory()
	factory.Register(&AssigneeStepHandler{})
	factory.Register(&ActionStepHandler{})

	types := factory.List()
	if len(types) != 2 {
		t.Fatalf("expected 2 handlers, got %d", len(types))
	}
}

func TestGlobalFactory_BuiltinHandlers(t *testing.T) {
	types := GlobalFactory.List()
	seen := make(map[string]bool)
	for _, typ := range types {
		seen[typ] = true
	}

	if !seen["assignee"] {
		t.Error("expected assignee handler to be registered")
	}
	if !seen["action"] {
		t.Error("expected action handler to be registered")
	}
}

func TestAssigneeStepHandler_Execute(t *testing.T) {
	handler := &AssigneeStepHandler{}
	ctx := context.Background()

	taskCtx := &WorkflowTaskContext{
		StepConfig: JSONB{"assignee": "user-1"},
		WorkflowData: models.JSONB{},
	}

	result, err := handler.Execute(ctx, taskCtx, JSONB{})
	if err != nil {
		t.Fatalf("Execute returned error: %v", err)
	}

	if result == nil {
		t.Fatal("expected result")
	}
	if a, ok := result.Output["assignee"]; !ok || a != "user-1" {
		t.Errorf("expected assignee user-1, got %v", result.Output["assignee"])
	}
}

func TestAssigneeStepHandler_Rollback(t *testing.T) {
	handler := &AssigneeStepHandler{}
	ctx := context.Background()

	taskCtx := &WorkflowTaskContext{
		WorkflowData: models.JSONB{"lastAssignee": "user-1"},
	}
	result := &StepResult{Output: JSONB{}}

	err := handler.Rollback(ctx, taskCtx, result)
	if err != nil {
		t.Fatalf("Rollback returned error: %v", err)
	}

	if _, ok := taskCtx.WorkflowData["lastAssignee"]; ok {
		t.Error("expected lastAssignee to be removed")
	}
}
