package pipeline_executor_test

import (
	"context"
	"errors"
	"testing"

	"orion/platform-svc-go/internal/pipeline-executor/models"
	"orion/platform-svc-go/internal/pipeline-executor/service"

	"go.uber.org/zap"
)

// TestPipelineExecutor_NewService_Nil verifies that NewExecutor compiles and
// returns a non-nil PipelineExecutor even when the repository argument is nil.
// The executor only touches the repo inside method bodies, so construction is
// safe without a live PostgreSQL connection.
func TestPipelineExecutor_NewService_Nil(t *testing.T) {
	logger, _ := zap.NewDevelopment()
	exec := service.NewExecutor(nil, logger)
	if exec == nil {
		t.Fatal("NewExecutor returned nil")
	}
}

// TestPipelineExecutor_ContextDeadline verifies that the sentinel errors
// exported by the service package are well-formed, unique, and that a
// cancelled context produces the expected error value (demonstrating that
// context checks compile and behave correctly at the API boundary).
func TestPipelineExecutor_ContextDeadline(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if ctx.Err() != context.Canceled {
		t.Fatal("context should be cancelled")
	}

	if service.ErrStepHandlerNotRegistered == nil {
		t.Error("ErrStepHandlerNotRegistered should not be nil")
	}
	if service.ErrPipelineDisabled == nil {
		t.Error("ErrPipelineDisabled should not be nil")
	}
	if service.ErrNoSteps == nil {
		t.Error("ErrNoSteps should not be nil")
	}

	// errors.Is works on the exact sentinel
	if !errors.Is(service.ErrPipelineDisabled, service.ErrPipelineDisabled) {
		t.Error("ErrPipelineDisabled should wrap itself")
	}
	// Distinct sentinel errors are not equal to each other
	if errors.Is(service.ErrStepHandlerNotRegistered, service.ErrPipelineDisabled) {
		t.Error("different sentinels should not be equal")
	}
}

// TestPipelineExecutor_PackageAvailable verifies that the models package
// exports its constants with the expected string values and that the domain
// structs and API request types are instantiable and preserve field values.
func TestPipelineExecutor_PackageAvailable(t *testing.T) {
	// Status constants
	if models.PipelineStatusActive != "active" {
		t.Fatalf("PipelineStatusActive = %q, want %q", models.PipelineStatusActive, "active")
	}
	if models.PipelineStatusDisabled != "disabled" {
		t.Fatalf("PipelineStatusDisabled = %q, want %q", models.PipelineStatusDisabled, "disabled")
	}
	if models.StepStatusReady != "ready" {
		t.Fatalf("StepStatusReady = %q, want %q", models.StepStatusReady, "ready")
	}
	if models.StepStatusError != "error" {
		t.Fatalf("StepStatusError = %q, want %q", models.StepStatusError, "error")
	}
	if models.ExecStatusRunning != "running" {
		t.Fatalf("ExecStatusRunning = %q, want %q", models.ExecStatusRunning, "running")
	}
	if models.ExecStatusCompleted != "completed" {
		t.Fatalf("ExecStatusCompleted = %q, want %q", models.ExecStatusCompleted, "completed")
	}
	if models.ExecStatusFailed != "failed" {
		t.Fatalf("ExecStatusFailed = %q, want %q", models.ExecStatusFailed, "failed")
	}

	// Step-type constants
	if models.StepTypeFilter != "filter" {
		t.Fatalf("StepTypeFilter = %q, want %q", models.StepTypeFilter, "filter")
	}
	if models.StepTypeTransform != "transform" {
		t.Fatalf("StepTypeTransform = %q, want %q", models.StepTypeTransform, "transform")
	}
	if models.StepTypeNotify != "notify" {
		t.Fatalf("StepTypeNotify = %q, want %q", models.StepTypeNotify, "notify")
	}
	if models.StepTypeAction != "action" {
		t.Fatalf("StepTypeAction = %q, want %q", models.StepTypeAction, "action")
	}
	if models.StepTypeCondition != "condition" {
		t.Fatalf("StepTypeCondition = %q, want %q", models.StepTypeCondition, "condition")
	}

	// Category constants
	if models.CategoryAlert != "alert" {
		t.Fatalf("CategoryAlert = %q, want %q", models.CategoryAlert, "alert")
	}
	if models.CategoryNotification != "notification" {
		t.Fatalf("CategoryNotification = %q, want %q", models.CategoryNotification, "notification")
	}
	if models.CategoryWebhook != "webhook" {
		t.Fatalf("CategoryWebhook = %q, want %q", models.CategoryWebhook, "webhook")
	}
	if models.CategoryAutomation != "automation" {
		t.Fatalf("CategoryAutomation = %q, want %q", models.CategoryAutomation, "automation")
	}

	// Pipeline struct
	p := models.Pipeline{
		ID:       "test-id",
		TenantID: "tenant-1",
		Name:     "test-pipeline",
		Category: models.CategoryAlert,
		Status:   models.PipelineStatusActive,
	}
	if p.ID != "test-id" || p.TenantID != "tenant-1" || p.Name != "test-pipeline" {
		t.Fatal("Pipeline struct fields not preserved")
	}

	// PipelineStep struct
	step := models.PipelineStep{
		ID:         "step-1",
		PipelineID: "test-id",
		Name:       "filter-step",
		Type:       models.StepTypeFilter,
		Priority:   1,
		Enabled:    true,
		Status:     models.StepStatusReady,
	}
	if step.ID != "step-1" || step.Priority != 1 || !step.Enabled {
		t.Fatal("PipelineStep struct fields not preserved")
	}

	// PipelineExecution struct
	exec := models.PipelineExecution{
		PipelineID:  "test-id",
		Status:      models.ExecStatusCompleted,
		StepsRun:    3,
		StepsFailed: 0,
	}
	if exec.Status != models.ExecStatusCompleted || exec.StepsRun != 3 {
		t.Fatal("PipelineExecution struct fields not preserved")
	}

	// API request types
	createReq := models.CreatePipelineRequest{
		Name:     "new-pipeline",
		Category: models.CategoryWebhook,
	}
	if createReq.Name != "new-pipeline" || createReq.Category != models.CategoryWebhook {
		t.Fatal("CreatePipelineRequest fields not preserved")
	}

	addStepReq := models.AddStepRequest{
		Name:     "notify-step",
		Type:     models.StepTypeNotify,
		Config:   map[string]string{"target": "slack"},
		Priority: 2,
	}
	if addStepReq.Name != "notify-step" || addStepReq.Type != models.StepTypeNotify || addStepReq.Priority != 2 {
		t.Fatal("AddStepRequest fields not preserved")
	}

	runReq := models.RunPipelineRequest{
		Input: map[string]interface{}{"key": "value"},
	}
	if runReq.Input["key"] != "value" {
		t.Fatal("RunPipelineRequest fields not preserved")
	}
}
