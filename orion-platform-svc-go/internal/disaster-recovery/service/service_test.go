package service

import (
	"context"
	"fmt"
	"testing"
	"time"

	"go.uber.org/zap/zaptest"
	"orion/platform-svc-go/internal/disaster-recovery/models"
	"orion/platform-svc-go/internal/disaster-recovery/orchestrator"
)

// --- Fake repository ---

type fakeRepo struct {
	plans   map[string]*models.DisasterPlan
	runs    []*models.RecoveryRun
	lastRun map[string]time.Time
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{
		plans:   make(map[string]*models.DisasterPlan),
		runs:    make([]*models.RecoveryRun, 0),
		lastRun: make(map[string]time.Time),
	}
}

func (r *fakeRepo) CountPlans(_ context.Context, _ string) (int, error) {
	return len(r.plans), nil
}

func (r *fakeRepo) CreatePlan(_ context.Context, p *models.DisasterPlan) error {
	if p.ID == "" {
		p.ID = fmt.Sprintf("plan-%d", len(r.plans)+1)
	}
	r.plans[p.ID] = p
	return nil
}

func (r *fakeRepo) GetPlan(_ context.Context, _, id string) (*models.DisasterPlan, error) {
	p, ok := r.plans[id]
	if !ok {
		return nil, fmt.Errorf("not found")
	}
	return p, nil
}

func (r *fakeRepo) ListPlans(_ context.Context, _ string, _, _ int) ([]models.DisasterPlan, error) {
	out := make([]models.DisasterPlan, 0, len(r.plans))
	for _, p := range r.plans {
		out = append(out, *p)
	}
	return out, nil
}

func (r *fakeRepo) UpdatePlan(_ context.Context, _, id string, updates map[string]interface{}) error {
	p, ok := r.plans[id]
	if !ok {
		return fmt.Errorf("not found")
	}
	if v, ok := updates["name"]; ok {
		p.Name = v.(string)
	}
	if v, ok := updates["description"]; ok {
		p.Description = v.(string)
	}
	if v, ok := updates["steps"]; ok {
		if s, ok := v.([]string); ok {
			p.Steps = fmt.Sprintf("%q", s)
		}
	}
	return nil
}

func (r *fakeRepo) UpdatePlanLastRun(_ context.Context, _, id string, t time.Time) error {
	r.lastRun[id] = t
	return nil
}

func (r *fakeRepo) CreateRun(_ context.Context, run *models.RecoveryRun) error {
	if run.ID == "" {
		run.ID = fmt.Sprintf("run-%d", len(r.runs)+1)
	}
	// Upsert: replace if ID already exists
	for i, existing := range r.runs {
		if existing.ID == run.ID {
			r.runs[i] = run
			return nil
		}
	}
	r.runs = append(r.runs, run)
	return nil
}

func (r *fakeRepo) GetRun(_ context.Context, _, planID, runID string) (*models.RecoveryRun, error) {
	for _, run := range r.runs {
		if run.PlanID == planID && run.ID == runID {
			return run, nil
		}
	}
	return nil, fmt.Errorf("not found")
}

func (r *fakeRepo) ListRuns(_ context.Context, _, planID string) ([]models.RecoveryRun, error) {
	out := make([]models.RecoveryRun, 0)
	for _, run := range r.runs {
		if run.PlanID == planID {
			out = append(out, *run)
		}
	}
	return out, nil
}

var _ RepositoryInterface = (*fakeRepo)(nil)

// --- Tests ---

func TestConvertSteps_ValidJSON(t *testing.T) {
	steps := convertSteps(`["kubectl scale --replicas=0","echo done"]`)
	if len(steps) != 2 {
		t.Fatalf("expected 2 steps, got %d", len(steps))
	}
	if steps[0].Command != "kubectl scale --replicas=0" {
		t.Errorf("step 0 command = %q, want 'kubectl scale --replicas=0'", steps[0].Command)
	}
	if steps[1].Command != "echo done" {
		t.Errorf("step 1 command = %q, want 'echo done'", steps[1].Command)
	}
	if steps[0].ID != "step-1" {
		t.Errorf("step 0 ID = %q, want 'step-1'", steps[0].ID)
	}
	if steps[0].Timeout != 60*time.Second {
		t.Errorf("step 0 timeout = %v, want 60s", steps[0].Timeout)
	}
	if steps[0].OnFail != "abort" {
		t.Errorf("step 0 onFail = %q, want 'abort'", steps[0].OnFail)
	}
}

func TestConvertSteps_InvalidJSON(t *testing.T) {
	steps := convertSteps("not json")
	if steps != nil {
		t.Errorf("expected nil for invalid JSON, got %v", steps)
	}
}

func TestConvertSteps_EmptyString(t *testing.T) {
	steps := convertSteps("")
	if steps != nil {
		t.Errorf("expected nil for empty string, got %v", steps)
	}
}

func TestTruncate_ShortString(t *testing.T) {
	got := truncate("hello", 64)
	if got != "hello" {
		t.Errorf("expected 'hello', got %q", got)
	}
}

func TestTruncate_LongString(t *testing.T) {
	long := make([]byte, 100)
	for i := range long {
		long[i] = 'a'
	}
	got := truncate(string(long), 64)
	// truncate returns s[:n-1] + "…" — 63 chars + 3-byte ellipsis = 66 bytes
	if len(got) != 66 {
		t.Errorf("expected length 66, got %d", len(got))
	}
	if got[63:] != "…" {
		t.Errorf("expected trailing ellipsis, got %q", got[63:])
	}
}

func TestService_New_NilOrch(t *testing.T) {
	svc := NewService(newFakeRepo())
	if svc.orch != nil {
		t.Error("expected nil orchestrator by default")
	}
}

func TestService_SetOrchestrator(t *testing.T) {
	svc := NewService(newFakeRepo())
	orch := orchestrator.NewDROrchestrator(nil, zaptest.NewLogger(t), nil)
	svc.SetOrchestrator(orch)
	if svc.orch == nil {
		t.Error("expected non-nil orchestrator after SetOrchestrator")
	}
}

func TestService_RunPlan_NoOrch(t *testing.T) {
	repo := newFakeRepo()
	repo.plans["p1"] = &models.DisasterPlan{
		ID: "p1", Name: "Test", Steps: `["echo hi"]`, Status: "active",
	}
	svc := NewService(repo)

	ctx := context.Background()
	run, err := svc.RunPlan(ctx, "t1", "p1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if run.Status != "running" {
		t.Errorf("expected status=running without orchestrator, got %s", run.Status)
	}
	if !run.EndedAt.IsZero() {
		t.Error("expected zero EndedAt without orchestrator")
	}
}

func TestService_RunPlan_WithOrch_Success(t *testing.T) {
	repo := newFakeRepo()
	repo.plans["p1"] = &models.DisasterPlan{
		ID: "p1", Name: "Test", Steps: `["echo hi"]`, Status: "active",
	}
	svc := NewService(repo)

	echoExec := func(ctx context.Context, cmd string) (string, error) {
		return "ok", nil
	}
	orch := orchestrator.NewDROrchestrator(nil, zaptest.NewLogger(t), echoExec)
	svc.SetOrchestrator(orch)

	ctx := context.Background()
	run, err := svc.RunPlan(ctx, "t1", "p1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if run.Status != "success" {
		t.Errorf("expected status=success with orchestrator, got %s", run.Status)
	}
	if run.EndedAt.IsZero() {
		t.Error("expected non-zero EndedAt with orchestrator")
	}
}

func TestService_RunPlan_WithOrch_Failure(t *testing.T) {
	repo := newFakeRepo()
	repo.plans["p1"] = &models.DisasterPlan{
		ID: "p1", Name: "Test", Steps: `["false","echo never"]`, Status: "active",
	}
	svc := NewService(repo)

	failExec := func(ctx context.Context, cmd string) (string, error) {
		return "", fmt.Errorf("step failed")
	}
	orch := orchestrator.NewDROrchestrator(nil, zaptest.NewLogger(t), failExec)
	svc.SetOrchestrator(orch)

	ctx := context.Background()
	run, err := svc.RunPlan(ctx, "t1", "p1")
	if err != nil {
		t.Fatalf("unexpected error from RunPlan: %v", err)
	}
	// autoRollback=true is passed to ExecuteSteps, so the status becomes "rolled-back"
	if run.Status != "rolled-back" {
		t.Errorf("expected status=rolled-back (autoRollback=true), got %s", run.Status)
	}
	if run.EndedAt.IsZero() {
		t.Error("expected non-zero EndedAt on failure")
	}
}

func TestService_RunPlan_PlanNotFound(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)

	ctx := context.Background()
	_, err := svc.RunPlan(ctx, "t1", "nonexistent")
	if err == nil {
		t.Error("expected error for nonexistent plan")
	}
}

func TestService_CreatePlan(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)

	ctx := context.Background()
	req := models.CreateDisasterPlanRequest{
		Name: "Test Plan", Description: "A test",
		Steps: []string{"echo hi", "echo done"},
	}
	plan, err := svc.CreatePlan(ctx, "t1", req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if plan.Name != "Test Plan" {
		t.Errorf("expected name='Test Plan', got %q", plan.Name)
	}
}

func TestService_ListPlans(t *testing.T) {
	repo := newFakeRepo()
	repo.plans["p1"] = &models.DisasterPlan{ID: "p1", Name: "Plan 1", Status: "active"}
	repo.plans["p2"] = &models.DisasterPlan{ID: "p2", Name: "Plan 2", Status: "active"}
	svc := NewService(repo)

	ctx := context.Background()
	resp, err := svc.ListPlans(ctx, "t1", 10, 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Total != 2 {
		t.Errorf("expected total=2, got %d", resp.Total)
	}
}
