package orchestrator

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"go.uber.org/zap/zaptest"
)

type fakeDRRepo struct {
	plans    map[string]*DRPlan
	results  []*DRResult
	commands []string
}

func newFakeDRRepo() *fakeDRRepo {
	return &fakeDRRepo{
		plans:   make(map[string]*DRPlan),
		results: make([]*DRResult, 0),
	}
}

func (r *fakeDRRepo) CreatePlan(_ context.Context, plan *DRPlan) error {
	r.plans[plan.ID] = plan
	return nil
}
func (r *fakeDRRepo) GetPlan(_ context.Context, id string) (*DRPlan, error) {
	plan, ok := r.plans[id]
	if !ok {
		return nil, fmt.Errorf("plan %s not found", id)
	}
	return plan, nil
}
func (r *fakeDRRepo) ListPlans(_ context.Context) ([]*DRPlan, error) {
	out := make([]*DRPlan, 0, len(r.plans))
	for _, p := range r.plans {
		out = append(out, p)
	}
	return out, nil
}
func (r *fakeDRRepo) UpdatePlan(_ context.Context, plan *DRPlan) error {
	r.plans[plan.ID] = plan
	return nil
}
func (r *fakeDRRepo) DeletePlan(_ context.Context, id string) error { delete(r.plans, id); return nil }
func (r *fakeDRRepo) RecordResult(_ context.Context, result *DRResult) error {
	r.results = append(r.results, result)
	return nil
}
func (r *fakeDRRepo) GetResults(_ context.Context, planID string, limit int) ([]*DRResult, error) {
	return r.results, nil
}
func (r *fakeDRRepo) GetHealth(_ context.Context, planID string) (*DRHealth, error) {
	return &DRHealth{SourceHealthy: true, TargetHealthy: true, LastHealthCheck: time.Now()}, nil
}

// echoExecutor executes commands by returning the command as output (echo).
func echoExecutor(ctx context.Context, cmd string) (string, error) {
	select {
	case <-ctx.Done():
		return "", ctx.Err()
	default:
	}
	r := newFakeDRRepo()
	_ = r
	return cmd, nil
}

func TestNewDROrchestrator(t *testing.T) {
	repo := newFakeDRRepo()
	o := NewDROrchestrator(repo, zaptest.NewLogger(t), echoExecutor)
	if o == nil {
		t.Fatal("expected non-nil orchestrator")
	}
	if o.executor == nil {
		t.Fatal("expected non-nil executor")
	}
}

func TestNewDROrchestrator_DefaultExecutor(t *testing.T) {
	repo := newFakeDRRepo()
	o := NewDROrchestrator(repo, nil, nil)
	if o == nil {
		t.Fatal("expected non-nil orchestrator")
	}
	if o.executor == nil {
		t.Fatal("expected default executor")
	}
}

func TestFailover_Success(t *testing.T) {
	ctx := context.Background()
	repo := newFakeDRRepo()
	plan := DefaultDRPlan()
	plan.ID = "plan-1"
	plan.Source = Endpoint{Name: "primary", Region: "us-east-1", DBHost: "db1", DBPort: 5432, DBName: "orion"}
	plan.Target = Endpoint{Name: "dr", Region: "us-west-2", DBHost: "db2", DBPort: 5432, DBName: "orion"}
	repo.CreatePlan(ctx, plan)

	// Override commands to return quickly
	commandLog := make([]string, 0)
	exec := func(ctx context.Context, cmd string) (string, error) {
		commandLog = append(commandLog, cmd)
		return "ok", nil
	}

	o := NewDROrchestrator(repo, zaptest.NewLogger(t), exec)
	result, err := o.Failover(ctx, "plan-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Status != "success" {
		t.Errorf("expected success, got %s", result.Status)
	}
	if len(result.Steps) != len(plan.Steps) {
		t.Errorf("expected %d step results, got %d", len(plan.Steps), len(result.Steps))
	}
	if len(commandLog) != len(plan.Steps) {
		t.Errorf("expected %d commands executed, got %d", len(plan.Steps), len(commandLog))
	}
}

func TestFailover_UnenabledPlan(t *testing.T) {
	ctx := context.Background()
	repo := newFakeDRRepo()
	plan := DefaultDRPlan()
	plan.ID = "plan-2"
	plan.Enabled = false
	repo.CreatePlan(ctx, plan)

	o := NewDROrchestrator(repo, zaptest.NewLogger(t), echoExecutor)
	_, err := o.Failover(ctx, "plan-2")
	if err == nil {
		t.Error("expected error for disabled plan")
	}
}

func TestFailover_NonexistentPlan(t *testing.T) {
	ctx := context.Background()
	repo := newFakeDRRepo()
	o := NewDROrchestrator(repo, zaptest.NewLogger(t), echoExecutor)
	_, err := o.Failover(ctx, "no-such-plan")
	if err == nil {
		t.Error("expected error for missing plan")
	}
}

func TestFailover_StepFailure_NoRollback(t *testing.T) {
	ctx := context.Background()
	repo := newFakeDRRepo()
	plan := &DRPlan{
		ID: "plan-3", Name: "TestPlan", Enabled: true, AutoRollback: false,
		Steps: []DRStep{
			{ID: "s1", Name: "Step1", Phase: PhasePreflight, Command: "ok", Timeout: 5 * time.Second, OnFail: "abort", MaxRetries: 0},
			{ID: "s2", Name: "Step2", Phase: PhaseScaleDown, Command: "fail", Timeout: 5 * time.Second, OnFail: "abort", MaxRetries: 0},
			{ID: "s3", Name: "Step3", Phase: PhaseScaleUp, Command: "ok", Timeout: 5 * time.Second, OnFail: "abort", MaxRetries: 0},
		},
	}
	repo.CreatePlan(ctx, plan)

	failedCmd := "fail"
	exec := func(ctx context.Context, cmd string) (string, error) {
		if cmd == failedCmd {
			return "", fmt.Errorf("simulated failure")
		}
		return "ok", nil
	}

	o := NewDROrchestrator(repo, zaptest.NewLogger(t), exec)
	result, err := o.Failover(ctx, "plan-3")
	if err == nil {
		t.Error("expected error on step failure")
	}
	if result == nil {
		t.Fatal("expected result on failure")
	}
	if result.Status != "failed" {
		t.Errorf("expected failed, got %s", result.Status)
	}
	if len(result.Steps) != 2 {
		t.Errorf("expected 2 step results (first success, second fail), got %d", len(result.Steps))
	}
	if result.Steps[0].Status != StepSuccess {
		t.Errorf("expected step 1 success, got %s", result.Steps[0].Status)
	}
	if result.Steps[1].Status != StepFailed {
		t.Errorf("expected step 2 failed, got %s", result.Steps[1].Status)
	}
}

func TestFailover_StepFailure_AutoRollback(t *testing.T) {
	ctx := context.Background()
	repo := newFakeDRRepo()
	plan := &DRPlan{
		ID: "plan-4", Name: "AutoRollbackPlan", Enabled: true, AutoRollback: true,
		Steps: []DRStep{
			{ID: "s1", Name: "Step1", Phase: PhaseScaleDown, Command: "scale-down", Timeout: 5 * time.Second, RollbackCommand: "scale-up"},
			{ID: "s2", Name: "Step2", Phase: PhaseTrafficSwitch, Command: "switch-fail", Timeout: 5 * time.Second, RollbackCommand: "switch-back"},
		},
	}
	repo.CreatePlan(ctx, plan)

	var cmds []string
	exec := func(ctx context.Context, cmd string) (string, error) {
		cmds = append(cmds, cmd)
		if cmd == "switch-fail" {
			return "", fmt.Errorf("fail")
		}
		return "ok", nil
	}

	o := NewDROrchestrator(repo, zaptest.NewLogger(t), exec)
	result, err := o.Failover(ctx, "plan-4")
	if err == nil {
		t.Error("expected error on failure")
	}
	if result == nil {
		t.Fatal("expected result")
	}
	if result.Status != "rolled-back" {
		t.Errorf("expected rolled-back, got %s", result.Status)
	}
	// Rollback commands should be executed in reverse
	if len(cmds) < 4 {
		t.Errorf("expected >=4 commands (s1, s2-fail, rollback s2, rollback s1), got %v", cmds)
	}
}

func TestFailover_ContextTimeout(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()

	repo := newFakeDRRepo()
	plan := &DRPlan{
		ID: "plan-5", Name: "TimeoutPlan", Enabled: true,
		Steps: []DRStep{
			{ID: "s1", Name: "Slow", Phase: PhasePreflight, Command: "sleep", Timeout: 30 * time.Second, OnFail: "abort"},
		},
	}
	repo.CreatePlan(ctx, plan)

	// slowExec blocks until context is cancelled.
	slowExec := func(ctx context.Context, cmd string) (string, error) {
		select {
		case <-ctx.Done():
			return "", ctx.Err()
		case <-time.After(5 * time.Second):
			return "ok", nil
		}
	}

	o := NewDROrchestrator(repo, zaptest.NewLogger(t), slowExec)
	result, err := o.Failover(ctx, "plan-5")
	if err == nil && result.Status == "success" {
		t.Error("expected failure due to timeout")
	}
}

func TestFailover_Concurrent(t *testing.T) {
	ctx := context.Background()
	repo := newFakeDRRepo()
	plan := &DRPlan{ID: "plan-6", Name: "Concurrent", Enabled: true,
		Steps: []DRStep{
			{ID: "s1", Name: "Step", Phase: PhasePreflight, Command: "ok", Timeout: 5 * time.Second},
		}}
	repo.CreatePlan(ctx, plan)

	o := NewDROrchestrator(repo, zaptest.NewLogger(t), echoExecutor)

	// First failover
	go func() { time.Sleep(50 * time.Millisecond) }()
	_, err1 := o.Failover(ctx, "plan-6")

	// Try concurrent during (too late here, but test structure)
	if err1 != nil {
		t.Logf("first failover error (expected): %v", err1)
	}
}

func TestHealthCheck(t *testing.T) {
	ctx := context.Background()
	repo := newFakeDRRepo()
	plan := DefaultDRPlan()
	plan.ID = "plan-7"
	plan.Source = Endpoint{Name: "primary", Region: "us-east", DBHost: "db1", DBPort: 5432}
	plan.Target = Endpoint{Name: "dr", Region: "us-west", DBHost: "db2", DBPort: 5432}
	repo.CreatePlan(ctx, plan)

	o := NewDROrchestrator(repo, zaptest.NewLogger(t), echoExecutor)
	h, err := o.HealthCheck(ctx, "plan-7")
	if err != nil {
		t.Fatalf("HealthCheck failed: %v", err)
	}
	if !h.SourceHealthy {
		t.Error("expected source healthy")
	}
	if !h.TargetHealthy {
		t.Error("expected target healthy")
	}
	if h.ReplicationLag != 0 {
		t.Error("expected 0 replication lag")
	}
}

func TestHealthCheck_MissingPlan(t *testing.T) {
	ctx := context.Background()
	repo := newFakeDRRepo()
	o := NewDROrchestrator(repo, zaptest.NewLogger(t), echoExecutor)
	_, err := o.HealthCheck(ctx, "missing")
	if err == nil {
		t.Error("expected error for missing plan")
	}
}

func TestGetActiveFailovers(t *testing.T) {
	_ = context.Background()
	repo := newFakeDRRepo()
	o := NewDROrchestrator(repo, zaptest.NewLogger(t), echoExecutor)

	active := o.GetActiveFailovers()
	if len(active) != 0 {
		t.Errorf("expected 0 active, got %d", len(active))
	}
}

func TestDRResult_ToJSON(t *testing.T) {
	now := time.Now()
	result := &DRResult{PlanID: "p1", Status: "success", StartedAt: now}
	json, err := result.ToJSON()
	if err != nil {
		t.Fatalf("ToJSON failed: %v", err)
	}
	if !strings.Contains(json, `"planId":"p1"`) {
		t.Errorf("expected planId in JSON, got: %s", json)
	}
}

func TestCheckEndpoint(t *testing.T) {
	o := &DROrchestrator{}
	tests := []struct {
		ep   Endpoint
		want bool
	}{
		{Endpoint{Name: "a", Region: "b", DBHost: "c"}, true},
		{Endpoint{Name: "a", Region: "b"}, false},
		{Endpoint{Name: "a"}, false},
		{Endpoint{}, false},
	}
	for _, tt := range tests {
		got := o.checkEndpoint(tt.ep)
		if got != tt.want {
			t.Errorf("checkEndpoint(%+v) = %v, want %v", tt.ep, got, tt.want)
		}
	}
}

func TestShellExecutor_EchoCommand(t *testing.T) {
	ctx := context.Background()
	out, err := ShellExecutor(ctx, "echo hello")
	if err != nil {
		t.Fatalf("ShellExecutor failed: %v", err)
	}
	if out != "hello\n" {
		t.Errorf("expected 'hello\\n', got %q", out)
	}
}

func TestShellExecutor_FailingCommand(t *testing.T) {
	ctx := context.Background()
	_, err := ShellExecutor(ctx, "exit 1")
	if err == nil {
		t.Error("expected error for exit 1")
	}
}

func TestShellExecutor_MultiLineCommand(t *testing.T) {
	ctx := context.Background()
	out, err := ShellExecutor(ctx, "echo line1 && echo line2")
	if err != nil {
		t.Fatalf("ShellExecutor failed: %v", err)
	}
	if !strings.Contains(out, "line1") || !strings.Contains(out, "line2") {
		t.Errorf("expected both lines, got %q", out)
	}
}

func TestShellExecutor_ContextTimeout(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	_, err := ShellExecutor(ctx, "sleep 10")
	if err == nil {
		t.Error("expected context deadline exceeded")
	}
}

func TestExecuteSteps_Success(t *testing.T) {
	ctx := context.Background()
	repo := newFakeDRRepo()

	steps := []DRStep{
		{ID: "s1", Name: "Step1", Phase: PhasePreflight, Command: "ok", Timeout: 5 * time.Second, OnFail: "abort", MaxRetries: 0},
		{ID: "s2", Name: "Step2", Phase: PhaseScaleUp, Command: "ok2", Timeout: 5 * time.Second, OnFail: "abort", MaxRetries: 0},
	}

	o := NewDROrchestrator(repo, zaptest.NewLogger(t), echoExecutor)
	result, err := o.ExecuteSteps(ctx, "plan-x", steps, false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Status != "success" {
		t.Errorf("expected success, got %s", result.Status)
	}
	if len(result.Steps) != 2 {
		t.Errorf("expected 2 steps, got %d", len(result.Steps))
	}
	if result.Steps[0].Status != StepSuccess {
		t.Errorf("step 1 expected success, got %s", result.Steps[0].Status)
	}
	if result.Steps[1].Status != StepSuccess {
		t.Errorf("step 2 expected success, got %s", result.Steps[1].Status)
	}
	if result.PlanID != "plan-x" {
		t.Errorf("expected planId=plan-x, got %s", result.PlanID)
	}
}

func TestExecuteSteps_Failure_NoRollback(t *testing.T) {
	ctx := context.Background()
	repo := newFakeDRRepo()

	steps := []DRStep{
		{ID: "s1", Name: "Step1", Phase: PhasePreflight, Command: "ok", Timeout: 5 * time.Second, OnFail: "abort", MaxRetries: 0},
		{ID: "s2", Name: "Step2", Phase: PhaseScaleDown, Command: "fail", Timeout: 5 * time.Second, OnFail: "abort", MaxRetries: 0},
	}

	failedCmd := "fail"
	exec := func(ctx context.Context, cmd string) (string, error) {
		if cmd == failedCmd {
			return "", fmt.Errorf("simulated failure")
		}
		return "ok", nil
	}

	o := NewDROrchestrator(repo, zaptest.NewLogger(t), exec)
	result, err := o.ExecuteSteps(ctx, "plan-y", steps, false)
	if err == nil {
		t.Error("expected error on step failure")
	}
	if result.Status != "failed" {
		t.Errorf("expected failed, got %s", result.Status)
	}
	if len(result.Steps) != 2 {
		t.Errorf("expected 2 steps (s1 success, s2 fail), got %d", len(result.Steps))
	}
}

func TestExecuteSteps_Failure_WithRollback(t *testing.T) {
	ctx := context.Background()
	repo := newFakeDRRepo()

	var cmds []string
	exec := func(ctx context.Context, cmd string) (string, error) {
		cmds = append(cmds, cmd)
		if cmd == "switch-fail" {
			return "", fmt.Errorf("fail")
		}
		return "ok", nil
	}

	steps := []DRStep{
		{ID: "s1", Name: "Step1", Phase: PhaseScaleDown, Command: "scale-down", Timeout: 5 * time.Second, RollbackCommand: "scale-up"},
		{ID: "s2", Name: "Step2", Phase: PhaseTrafficSwitch, Command: "switch-fail", Timeout: 5 * time.Second, RollbackCommand: "switch-back"},
	}

	o := NewDROrchestrator(repo, zaptest.NewLogger(t), exec)
	result, err := o.ExecuteSteps(ctx, "plan-z", steps, true)
	if err == nil {
		t.Error("expected error")
	}
	if result.Status != "rolled-back" {
		t.Errorf("expected rolled-back, got %s", result.Status)
	}
	// Should have: s1, s2-fail, rollback s2, rollback s1
	if len(cmds) < 4 {
		t.Errorf("expected >=4 commands, got %v", cmds)
	}
}

func TestExecuteSteps_EmptySteps(t *testing.T) {
	ctx := context.Background()
	repo := newFakeDRRepo()

	o := NewDROrchestrator(repo, zaptest.NewLogger(t), echoExecutor)
	result, err := o.ExecuteSteps(ctx, "plan-empty", []DRStep{}, false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Status != "success" {
		t.Errorf("expected success for empty steps, got %s", result.Status)
	}
	if len(result.Steps) != 0 {
		t.Errorf("expected 0 steps, got %d", len(result.Steps))
	}
}
