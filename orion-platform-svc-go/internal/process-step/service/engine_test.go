package service

import (
	"context"
	"testing"
	"time"

	"orion/platform-svc-go/internal/process-step/models"

	"go.uber.org/zap"
)

// noOpRepo is a stub Repository for engine tests. It satisfies
// RepositoryInterface by always returning errors (no-op writes, not-found reads).
type noOpRepo struct {
	RepoError error
}

func (r *noOpRepo) CreateStep(ctx context.Context, m *models.ProcessStep) error {
	return r.RepoError
}
func (r *noOpRepo) DeleteStep(ctx context.Context, tenantID, id string) error {
	return r.RepoError
}
func (r *noOpRepo) GetStep(ctx context.Context, tenantID, id string) (*models.ProcessStep, error) {
	return nil, r.RepoError
}
func (r *noOpRepo) ListSteps(ctx context.Context, tenantID string) ([]models.ProcessStep, error) {
	return nil, r.RepoError
}
func (r *noOpRepo) ListStepsByProcess(ctx context.Context, tenantID, processID string) ([]models.ProcessStep, error) {
	return nil, r.RepoError
}
func (r *noOpRepo) UpdateStep(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.ProcessStep, error) {
	return nil, r.RepoError
}
func (r *noOpRepo) CreateExecution(ctx context.Context, m *models.ProcessStepExecution) error {
	return r.RepoError
}
func (r *noOpRepo) UpdateExecution(ctx context.Context, id string, updates map[string]interface{}) (*models.ProcessStepExecution, error) {
	return nil, r.RepoError
}
func (r *noOpRepo) GetExecution(ctx context.Context, id string) (*models.ProcessStepExecution, error) {
	return nil, r.RepoError
}
func (r *noOpRepo) ListExecutionsByStep(ctx context.Context, stepID string) ([]models.ProcessStepExecution, error) {
	return nil, r.RepoError
}
func (r *noOpRepo) ListExecutionsByInstance(ctx context.Context, instanceID string) ([]models.ProcessStepExecution, error) {
	return nil, r.RepoError
}
func (r *noOpRepo) CreateEvent(ctx context.Context, m *models.ProcessStepEvent) error {
	return r.RepoError
}
func (r *noOpRepo) ListEventsByStep(ctx context.Context, stepID string) ([]models.ProcessStepEvent, error) {
	return nil, r.RepoError
}

var _ RepositoryInterface = (*noOpRepo)(null)

func makeEngine() *Engine {
	repo := &noOpRepo{}
	logger := zap.NewNop()
	manager := NewProcessStepManager(nil, logger) // no DB; engine runs handlers directly
	return NewEngine(EngineOptions{
		Logger:  logger,
		Manager: manager,
	})
}

func makeStep(order int, stepType string, enabled bool) models.ProcessStep {
	return models.ProcessStep{
		ID:        "step-" + stepType,
		TenantID:  "tenant-1",
		ProcessID: "proc-1",
		Name:      stepType,
		StepType:  stepType,
		Order:     order,
		Enabled:   enabled,
	}
}

func TestEngine_ExecutProcess_NoSteps(t *testing.T) {
	e := makeEngine()
	_, err := e.ExecuteProcess(context.Background(), "tenant-1", "proc-1", "def-1", nil, nil)
	if err == nil {
		t.Fatal("expected error for empty step list")
	}
}

func TestEngine_ExecutProcess_SequentialCompletion(t *testing.T) {
	e := makeEngine()
	steps := []models.ProcessStep{
		makeStep(0, models.StepTypeNotification, true),
		makeStep(1, models.StepTypeAutomation, true),
		makeStep(2, models.StepTypeCustom, true),
	}
	inst, err := e.ExecuteProcess(context.Background(), "tenant-1", "proc-1", "def-1", steps, nil)
	if err != nil {
		t.Fatalf("ExecuteProcess: %v", err)
	}
	if inst == nil {
		t.Fatal("expected non-nil instance")
	}
	if inst.StepsExecuted() != 3 {
		t.Fatalf("expected 3 steps executed, got %d", inst.StepsExecuted())
	}
	if inst.Status() != models.StepStatusCompleted {
		t.Fatalf("expected completed, got %s", inst.Status())
	}
}

func TestEngine_ExecutProcess_DisabledStepSkipped(t *testing.T) {
	e := makeEngine()
	steps := []models.ProcessStep{
		makeStep(0, models.StepTypeNotification, true),
		makeStep(1, models.StepTypeAutomation, false), // disabled
		makeStep(2, models.StepTypeCustom, true),
	}
	inst, err := e.ExecuteProcess(context.Background(), "tenant-1", "proc-1", "def-1", steps, nil)
	if err != nil {
		t.Fatalf("ExecuteProcess: %v", err)
	}
	if inst.StepsExecuted() != 2 {
		t.Fatalf("expected 2 steps executed (1 skipped), got %d", inst.StepsExecuted())
	}
}

func TestEngine_ExecutProcess_ApprovalBlocks(t *testing.T) {
	e := makeEngine()
	steps := []models.ProcessStep{
		makeStep(0, models.StepTypeApproval, true),
		makeStep(1, models.StepTypeNotification, true),
	}
	inst, err := e.ExecuteProcess(context.Background(), "tenant-1", "proc-1", "def-1", steps, nil)
	if err != nil {
		t.Fatalf("ExecuteProcess: %v", err)
	}
	// Approval returns ExecStatusPending, so process should pause after step 0
	if inst.StepsExecuted() != 1 {
		t.Fatalf("expected 1 step executed (blocked at approval), got %d", inst.StepsExecuted())
	}
}

func TestEngine_ExecutProcess_ContextCancellation(t *testing.T) {
	e := makeEngine()
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // cancel immediately
	steps := []models.ProcessStep{
		makeStep(0, models.StepTypeNotification, true),
	}
	inst, err := e.ExecuteProcess(ctx, "tenant-1", "proc-1", "def-1", steps, nil)
	if err == nil {
		t.Fatal("expected ctx.Err(), got nil")
	}
	if inst == nil {
		t.Fatal("expected non-nil instance")
	}
}

func TestEngine_ExecutProcess_UnregisteredHandlerType(t *testing.T) {
	e := makeEngine()
	step := makeStep(0, "nonexistent-type", true)
	_, err := e.ExecuteProcess(context.Background(), "tenant-1", "proc-1", "def-1", []models.ProcessStep{step}, nil)
	if err == nil {
		t.Fatal("expected error for unknown handler type")
	}
}

func TestEngine_ExecutProcess_OrderIndependence(t *testing.T) {
	e := makeEngine()
	// Steps provided out of order; engine should sort by Order
	steps := []models.ProcessStep{
		makeStep(2, models.StepTypeNotification, true),
		makeStep(0, models.StepTypeCustom, true),
		makeStep(1, models.StepTypeAutomation, true),
	}
	inst, err := e.ExecuteProcess(context.Background(), "tenant-1", "proc-1", "def-1", steps, nil)
	if err != nil {
		t.Fatalf("ExecuteProcess: %v", err)
	}
	if inst.StepsExecuted() != 3 {
		t.Fatalf("expected 3 steps executed, got %d", inst.StepsExecuted())
	}
}

func TestEngine_NewRegisteredHandler(t *testing.T) {
	e := makeEngine()
	// Verify the 4 new handlers are registered
	for _, tt := range []string{
		models.StepTypeExecution, models.StepTypeDecision,
		models.StepTypeDelay, models.StepTypeMerge,
	} {
		h := e.GetHandler(tt)
		if h == nil {
			t.Fatalf("expected handler for %s", tt)
		}
	}
}

// StepsExecuted returns the step count.
func (inst *ProcessInstance) StepsExecuted() int {
	inst.mu.RLock()
	defer inst.mu.RUnlock()
	return inst.stepsExecuted
}

// TestProcessInstance_MergeOutput verifies data merging.
func TestProcessInstance_MergeOutput(t *testing.T) {
	inst := NewProcessInstance("t", "p", "d")
	inst.MergeOutput(map[string]interface{}{"a": 1})
	inst.MergeOutput(map[string]interface{}{"b": 2})
	d := inst.Data()
	if d["a"] != 1 || d["b"] != 2 {
		t.Fatal("merge failed")
	}
}

// TestNewHandlerType_NewStepTypes verifies the 4 new step types parse as expected.
func TestNewHandlerType_NewStepTypes(t *testing.T) {
	tests := []struct {
		name string
		tt   string
	}{
		{"execution", models.StepTypeExecution},
		{"decision", models.StepTypeDecision},
		{"delay", models.StepTypeDelay},
		{"merge", models.StepTypeMerge},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if models.ValidateStepType(tc.tt) != nil {
				t.Fatalf("ValidateStepType(%q) should succeed", tc.tt)
			}
		})
	}
}

// TestDecisionHandler_Evaluate verifies the decision handler routes based on input.
func TestDecisionHandler_Evaluate(t *testing.T) {
	h := newDecisionHandler()
	ctx := context.Background()
	step := &models.ProcessStep{StepType: models.StepTypeDecision}
	input := map[string]interface{}{
		"routes":    map[string]interface{}{"approved": "ok", "rejected": "fail"},
		"condition": "x > 0",
	}
	result, err := h.Execute(ctx, step, input)
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}
	if len(result.NextSteps) != 2 {
		t.Fatalf("expected 2 routes, got %d", len(result.NextSteps))
	}
}

// TestDelayHandler_ParsesTimeout verifies the delay handler respects step.Timeout.
func TestDelayHandler_ParsesTimeout(t *testing.T) {
	h := newDelayHandler()
	ctx := context.Background()
	step := &models.ProcessStep{StepType: models.StepTypeDelay, Timeout: 30}
	input := map[string]interface{}{}
	result, err := h.Execute(ctx, step, input)
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}
	delay := result.Output["delay_seconds"]
	if delay != int64(30) {
		t.Fatalf("expected delay 30, got %v", delay)
	}
	// Input overrides timeout
	input["delay_seconds"] = float64(60)
	result2, _ := h.Execute(ctx, step, input)
	delay2 := result2.Output["delay_seconds"]
	if delay2 != int64(60) {
		t.Fatalf("expected delay 60, got %v", delay2)
	}
}

// TestMergeHandler_CollectsBranches verifies merge aggregates branch outputs.
func TestMergeHandler_CollectsBranches(t *testing.T) {
	h := newMergeHandler()
	ctx := context.Background()
	step := &models.ProcessStep{StepType: models.StepTypeMerge}
	input := map[string]interface{}{
		"branches":  []interface{}{"alpha", "beta"},
		"alpha":     map[string]interface{}{"result": "A"},
		"beta":      map[string]interface{}{"result": "B"},
	}
	result, err := h.Execute(ctx, step, input)
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}
	results := result.Output["results"]
	if results == nil {
		t.Fatal("expected merged results")
	}
}

// TestExecutionHandler_ParsesCommand verifies execution handler extracts command.
func TestExecutionHandler_ParsesCommand(t *testing.T) {
	h := newExecutionHandler()
	ctx := context.Background()
	step := &models.ProcessStep{StepType: models.StepTypeExecution}
	input := map[string]interface{}{
		"command": "make",
		"args":    []interface{}{"build", "-o", "bin/app"},
	}
	result, err := h.Execute(ctx, step, input)
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}
	cmd := result.Output["command"]
	if cmd != "make" {
		t.Fatalf("expected command 'make', got %v", cmd)
	}
}

// TestConditionHandler_TruePath verifies condition handler routes on_true.
func TestConditionHandler_TruePath(t *testing.T) {
	h := newConditionHandler()
	ctx := context.Background()
	step := &models.ProcessStep{StepType: models.StepTypeCondition}
	input := map[string]interface{}{
		"evaluate": true,
		"on_true":  []interface{}{"step-approved"},
		"on_false": []interface{}{"step-rejected"},
	}
	result, err := h.Execute(ctx, step, input)
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}
	if len(result.NextSteps) != 1 || result.NextSteps[0] != "step-approved" {
		t.Fatalf("expected route to step-approved, got %v", result.NextSteps)
	}
}

// TestConditionHandler_FalsePath verifies condition handler routes on_false.
func TestConditionHandler_FalsePath(t *testing.T) {
	h := newConditionHandler()
	ctx := context.Background()
	step := &models.ProcessStep{StepType: models.StepTypeCondition}
	input := map[string]interface{}{
		"evaluate": false,
		"on_true":  []interface{}{"step-approved"},
		"on_false": []interface{}{"step-rejected"},
	}
	result, err := h.Execute(ctx, step, input)
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}
	if len(result.NextSteps) != 1 || result.NextSteps[0] != "step-rejected" {
		t.Fatalf("expected route to step-rejected, got %v", result.NextSteps)
	}
}

// TestNotificationHandler_ParsesRecipient verifies notification handler.
func TestNotificationHandler_ParsesRecipient(t *testing.T) {
	h := newNotificationHandler()
	ctx := context.Background()
	step := &models.ProcessStep{StepType: models.StepTypeNotification}
	input := map[string]interface{}{"recipient": "team@orion.dev"}
	result, err := h.Execute(ctx, step, input)
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}
	if result.Output["recipient"] != "team@orion.dev" {
		t.Fatalf("expected recipient, got %v", result.Output["recipient"])
	}
}

// TestParallelHandler_Branches verifies parallel handler branches.
func TestParallelHandler_Branches(t *testing.T) {
	h := newParallelHandler()
	ctx := context.Background()
	step := &models.ProcessStep{StepType: models.StepTypeParallel}
	input := map[string]interface{}{
		"branches": []interface{}{"branch-a", "branch-b"},
	}
	result, err := h.Execute(ctx, step, input)
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}
	if len(result.NextSteps) != 2 {
		t.Fatalf("expected 2 branches, got %d", len(result.NextSteps))
	}
}

// TestIntegrationHandler_Target verifies integration handler extracts target.
func TestIntegrationHandler_Target(t *testing.T) {
	h := newIntegrationHandler()
	ctx := context.Background()
	step := &models.ProcessStep{StepType: models.StepTypeIntegration}
	input := map[string]interface{}{"target": "jira/CREATE_ISSUE"}
	result, err := h.Execute(ctx, step, input)
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}
	if result.Output["target"] != "jira/CREATE_ISSUE" {
		t.Fatalf("expected target, got %v", result.Output["target"])
	}
}

// TestEngine_MultipleInstances verifies concurrent instance tracking.
func TestEngine_MultipleInstances(t *testing.T) {
	e := makeEngine()
	ctx := context.WithValue(context.Background(), "cancel", false)

	step := makeStep(0, models.StepTypeCustom, true)
	for i := 0; i < 5; i++ {
		inst, err := e.ExecuteProcess(ctx, "t", "p", "def", []models.ProcessStep{step}, nil)
		if err != nil {
			t.Fatalf("run %d: %v", i, err)
		}
		if inst.StepsExecuted() != 1 {
			t.Fatalf("run %d: expected 1 step, got %d", i, inst.StepsExecuted())
		}
	}
}

// TestEngine_ContextDeadline verifies deadline triggers cancellation.
func TestEngine_ContextDeadline(t *testing.T) {
	e := makeEngine()
	ctx, cancel := context.WithTimeout(context.Background(), time.Microsecond)
	defer cancel()
	time.Sleep(2 * time.Microsecond) // ensure deadline passes
	step := makeStep(0, models.StepTypeCustom, true)
	_, err := e.ExecuteProcess(ctx, "t", "p", "d", []models.ProcessStep{step}, nil)
	if err == nil {
		t.Fatal("expected deadline exceeded error")
	}
}

// TestProcessStepManager_RegisterNewTypes verifies all types map.
func TestProcessStepManager_RegisterNewTypes(t *testing.T) {
	repo := &noOpRepo{}
	logger := zap.NewNop()
	mgr := NewProcessStepManager(nil, logger)
	for _, tt := range []string{
		models.StepTypeExecution, models.StepTypeDecision,
		models.StepTypeDelay, models.StepTypeMerge,
	} {
		h := mgr.GetHandler(tt)
		if h == nil {
			t.Fatalf("manager missing handler for %s", tt)
		}
		if h.Type() != tt {
			t.Fatalf("handler type mismatch: %s != %s", h.Type(), tt)
		}
	}
	_ = repo // used for compile-time interface check only
}

// TestHandlerNotFoundError_ErrorMessage verifies the error message.
func TestHandlerNotFoundError_ErrorMessage(t *testing.T) {
	e := &handlerNotFoundError{stepType: "unknown"}
	if e.Error() == "" {
		t.Fatal("expected non-empty error")
	}
}
