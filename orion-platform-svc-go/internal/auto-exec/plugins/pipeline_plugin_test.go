package plugins

import (
	"context"
	"errors"
	"testing"
	"time"

	"orion/platform-svc-go/internal/auto-exec/interfaces"
)

// ---------------------------------------------------------------------------
// Mock runner for testing
// ---------------------------------------------------------------------------

type mockPipelineRunner struct {
	called    bool
	calledID  string
	calledTenant string
	calledInputs map[string]interface{}
	result    *PipelineRunResult
	err       error
}

func (m *mockPipelineRunner) RunPipeline(ctx context.Context, tenantID, pipelineID string, inputs map[string]interface{}) (*PipelineRunResult, error) {
	m.called = true
	m.calledID = pipelineID
	m.calledTenant = tenantID
	m.calledInputs = inputs
	return m.result, m.err
}

// ---------------------------------------------------------------------------
// Name / Description / DefaultTimeout
// ---------------------------------------------------------------------------

func TestPipelinePluginName(t *testing.T) {
	p := &PipelineExecutorPlugin{runner: &DefaultPipelineRunner{}}
	if got := p.Name(); got != PluginTypePipeline {
		t.Fatalf("expected Name()=%q, got %q", PluginTypePipeline, got)
	}
}

func TestPipelinePluginDescription(t *testing.T) {
	p := &PipelineExecutorPlugin{runner: &DefaultPipelineRunner{}}
	if p.Description() == "" {
		t.Fatal("expected non-empty Description()")
	}
}

func TestPipelinePluginDefaultTimeout(t *testing.T) {
	p := &PipelineExecutorPlugin{runner: &DefaultPipelineRunner{}}
	d := p.DefaultTimeout()
	if d <= 0 {
		t.Fatal("expected positive DefaultTimeout()")
	}
}

// ---------------------------------------------------------------------------
// Validate
// ---------------------------------------------------------------------------

func TestPipelinePluginValidateNilRunner(t *testing.T) {
	p := &PipelineExecutorPlugin{}
	err := p.Validate(map[string]interface{}{"pipeline_id": "123"})
	if err == nil {
		t.Fatal("expected error when runner is nil")
	}
	if !errors.Is(err, interfaces.ErrInvalidParams) {
		t.Fatalf("expected ErrInvalidParams, got: %v", err)
	}
}

func TestPipelinePluginValidateMissingPipelineID(t *testing.T) {
	p := &PipelineExecutorPlugin{runner: &DefaultPipelineRunner{}}
	err := p.Validate(map[string]interface{}{})
	if err == nil {
		t.Fatal("expected error when pipeline_id is missing")
	}
}

func TestPipelinePluginValidateEmptyPipelineID(t *testing.T) {
	p := &PipelineExecutorPlugin{runner: &DefaultPipelineRunner{}}
	err := p.Validate(map[string]interface{}{"pipeline_id": ""})
	if err == nil {
		t.Fatal("expected error when pipeline_id is empty")
	}
}

func TestPipelinePluginValidateWrongType(t *testing.T) {
	p := &PipelineExecutorPlugin{runner: &DefaultPipelineRunner{}}
	err := p.Validate(map[string]interface{}{"pipeline_id": 123})
	if err == nil {
		t.Fatal("expected error when pipeline_id is not a string")
	}
}

func TestPipelinePluginValidateSuccess(t *testing.T) {
	p := &PipelineExecutorPlugin{runner: &DefaultPipelineRunner{}}
	err := p.Validate(map[string]interface{}{"pipeline_id": "pl-001"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

// ---------------------------------------------------------------------------
// Execute
// ---------------------------------------------------------------------------

func TestPipelinePluginExecuteNilRunner(t *testing.T) {
	p := &PipelineExecutorPlugin{}
	_, err := p.Execute(context.Background(), map[string]interface{}{"pipeline_id": "pl-1"})
	if err == nil {
		t.Fatal("expected error when runner is nil")
	}
}

func TestPipelinePluginExecuteSuccess(t *testing.T) {
	mr := &mockPipelineRunner{
		result: &PipelineRunResult{
			ExecutionID: "exec-42",
			PipelineID:  "pl-1",
			Status:      "completed",
			StepsRun:    3,
			StepsFailed: 0,
			DurationMs:  1234,
		},
	}
	p := &PipelineExecutorPlugin{runner: mr}
	params := map[string]interface{}{
		"pipeline_id": "pl-1",
		"inputs":      map[string]interface{}{"key": "val"},
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	res, err := p.Execute(ctx, params)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !mr.called {
		t.Fatal("expected runner to be called")
	}
	if mr.calledID != "pl-1" {
		t.Fatalf("expected pipelineID=pl-1, got %s", mr.calledID)
	}
	if res.ExitCode != 0 {
		t.Fatalf("expected ExitCode=0, got %d", res.ExitCode)
	}
	if res.DurationMs < 0 {
		t.Fatal("expected DurationMs >= 0")
	}
	if res.Stdout == "" {
		t.Fatal("expected non-empty Stdout")
	}
}

func TestPipelinePluginExecuteDefaultsTenant(t *testing.T) {
	mr := &mockPipelineRunner{
		result: &PipelineRunResult{PipelineID: "pl-1", Status: "completed"},
	}
	p := &PipelineExecutorPlugin{runner: mr}
	params := map[string]interface{}{"pipeline_id": "pl-1"}
	_, err := p.Execute(context.Background(), params)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if mr.calledTenant != "system" {
		t.Fatalf("expected tenantID=system, got %s", mr.calledTenant)
	}
}

func TestPipelinePluginExecuteCustomTenant(t *testing.T) {
	mr := &mockPipelineRunner{
		result: &PipelineRunResult{PipelineID: "pl-1", Status: "completed"},
	}
	p := &PipelineExecutorPlugin{runner: mr}
	params := map[string]interface{}{
		"pipeline_id": "pl-1",
		"tenant_id":   "tenant-a",
	}
	_, err := p.Execute(context.Background(), params)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if mr.calledTenant != "tenant-a" {
		t.Fatalf("expected tenantID=tenant-a, got %s", mr.calledTenant)
	}
}

func TestPipelinePluginExecuteForwardsInputs(t *testing.T) {
	mr := &mockPipelineRunner{
		result: &PipelineRunResult{PipelineID: "pl-1", Status: "completed"},
	}
	p := &PipelineExecutorPlugin{runner: mr}
	inputs := map[string]interface{}{"foo": "bar", "n": 42}
	params := map[string]interface{}{
		"pipeline_id": "pl-1",
		"inputs":      inputs,
	}
	_, err := p.Execute(context.Background(), params)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if mr.calledInputs == nil {
		t.Fatal("expected inputs to be forwarded")
	}
	if mr.calledInputs["foo"] != "bar" {
		t.Fatalf("expected inputs.foo=bar, got %v", mr.calledInputs["foo"])
	}
}

func TestPipelinePluginExecuteRunnerError(t *testing.T) {
	mr := &mockPipelineRunner{err: errors.New("pipeline not found")}
	p := &PipelineExecutorPlugin{runner: mr}
	params := map[string]interface{}{"pipeline_id": "pl-999"}

	res, err := p.Execute(context.Background(), params)
	if err == nil {
		t.Fatal("expected error from Execute when runner fails")
	}
	if res == nil {
		t.Fatal("expected non-nil result even on error")
	}
	if res.ExitCode != 1 {
		t.Fatalf("expected ExitCode=1 on error, got %d", res.ExitCode)
	}
	if res.ErrorMessage != "pipeline not found" {
		t.Fatalf("expected ErrorMessage='pipeline not found', got %q", res.ErrorMessage)
	}
}

// ---------------------------------------------------------------------------
// DefaultPipelineRunner
// ---------------------------------------------------------------------------

func TestDefaultPipelineRunner(t *testing.T) {
	r := NewDefaultPipelineRunner()
	ctx := context.Background()
	res, err := r.RunPipeline(ctx, "tenant-1", "pl-1", map[string]interface{}{"x": 1})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.PipelineID != "pl-1" {
		t.Fatalf("expected PipelineID=pl-1, got %s", res.PipelineID)
	}
}

// ---------------------------------------------------------------------------
// Package-level TriggerPipeline
// ---------------------------------------------------------------------------

func TestTriggerPipelineNotConfigured(t *testing.T) {
	// Save and restore the package-level runner
	original := GetTriggerPipelineRunner()
	SetTriggerPipelineRunner(nil)
	defer SetTriggerPipelineRunner(original)

	_, err := TriggerPipeline(context.Background(), "pl-1", map[string]interface{}{})
	if err == nil {
		t.Fatal("expected error when runner is not configured")
	}
}

func TestTriggerPipelineWithRunner(t *testing.T) {
	original := GetTriggerPipelineRunner()
	defer SetTriggerPipelineRunner(original)

	mr := &mockPipelineRunner{
		result: &PipelineRunResult{PipelineID: "pl-7", Status: "running"},
	}
	SetTriggerPipelineRunner(mr)

	res, err := TriggerPipeline(context.Background(), "pl-7", map[string]interface{}{"tenant_id": "t-1"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.PipelineID != "pl-7" {
		t.Fatalf("expected PipelineID=pl-7, got %s", res.PipelineID)
	}
	if !mr.called {
		t.Fatal("expected runner to be called")
	}
	if mr.calledTenant != "t-1" {
		t.Fatalf("expected tenant=t-1, got %s", mr.calledTenant)
	}
}

// ---------------------------------------------------------------------------
// NewPipelinePlugin
// ---------------------------------------------------------------------------

func TestNewPipelinePlugin(t *testing.T) {
	runner := NewDefaultPipelineRunner()
	p := NewPipelinePlugin(runner)
	if p == nil {
		t.Fatal("expected non-nil plugin")
	}
	if p.Name() != PluginTypePipeline {
		t.Fatalf("expected Name=%q, got %q", PluginTypePipeline, p.Name())
	}
}
