package service_test

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	"orion/platform-svc-go/internal/ai-agent-run/models"
	"orion/platform-svc-go/internal/ai-agent-run/service"
)

// -----------------------------------------------------------------------------
// fake repository
// -----------------------------------------------------------------------------

type fakeAgentRunRepo struct {
	runs        map[string]*models.AgentRun
	decisions   []models.AgentDecision
	createRunFn func(ctx context.Context, run *models.AgentRun) error
}

func newFakeAgentRunRepo(runs ...*models.AgentRun) *fakeAgentRunRepo {
	fake := &fakeAgentRunRepo{
		runs:      make(map[string]*models.AgentRun, len(runs)),
		decisions: nil,
	}
	for _, r := range runs {
		fake.runs[r.ID] = r
	}
	return fake
}

func (f *fakeAgentRunRepo) CreateRun(ctx context.Context, run *models.AgentRun) error {
	if f.createRunFn != nil {
		return f.createRunFn(ctx, run)
	}
	if run.ID == "" {
		run.ID = "run-created-001"
	}
	f.runs[run.ID] = run
	return nil
}

func (f *fakeAgentRunRepo) GetByTenant(ctx context.Context, id string, tenantID string) (*models.AgentRun, error) {
	r, ok := f.runs[id]
	if !ok || r.TenantID != tenantID {
		return nil, errors.New("not found")
	}
	return r, nil
}

func (f *fakeAgentRunRepo) GetByID(ctx context.Context, id string, tenantID string) (*models.AgentRun, error) {
	r, ok := f.runs[id]
	if !ok {
		return nil, errors.New("not found")
	}
	return r, nil
}

func (f *fakeAgentRunRepo) List(ctx context.Context, tenantID string, filter *models.ListFilter) ([]models.AgentRun, error) {
	var result []models.AgentRun
	for _, r := range f.runs {
		if r.TenantID == tenantID {
			result = append(result, *r)
		}
	}
	return result, nil
}

func (f *fakeAgentRunRepo) Count(ctx context.Context, tenantID string, filter *models.ListFilter) (int64, error) {
	var c int64
	for _, r := range f.runs {
		if r.TenantID == tenantID {
			c++
		}
	}
	return c, nil
}

func (f *fakeAgentRunRepo) UpdateStatus(ctx context.Context, id string, tenantID string, status models.AgentRunStatus, completedAt *int64) (*models.AgentRun, error) {
	r, ok := f.runs[id]
	if !ok {
		return nil, errors.New("not found")
	}
	r.Status = status
	if completedAt != nil {
		r.CompletedAt = sql.NullInt64{Int64: *completedAt, Valid: true}
	}
	return r, nil
}

func (f *fakeAgentRunRepo) CancelRun(ctx context.Context, id string, tenantID string) (*models.AgentRun, error) {
	return f.UpdateStatus(ctx, id, tenantID, models.AgentRunStatusCancelled, nil)
}

func (f *fakeAgentRunRepo) UpdateStep(ctx context.Context, id string, tenantID string, step int) error {
	r, ok := f.runs[id]
	if !ok {
		return errors.New("not found")
	}
	r.CurrentStep = step
	return nil
}

func (f *fakeAgentRunRepo) CreateDecision(ctx context.Context, d *models.AgentDecision) error {
	if d.ID == "" {
		d.ID = "dec-001"
	}
	f.decisions = append(f.decisions, *d)
	return nil
}

func (f *fakeAgentRunRepo) GetDecisionsByRunID(ctx context.Context, runID string, tenantID string) ([]models.AgentDecision, error) {
	var decs []models.AgentDecision
	for _, d := range f.decisions {
		if d.RunID == runID {
			decs = append(decs, d)
		}
	}
	return decs, nil
}

func (f *fakeAgentRunRepo) GetStats(ctx context.Context, tenantID string) (*models.AgentRunStats, error) {
	return &models.AgentRunStats{Total: int64(len(f.runs))}, nil
}

var _ service.RepositoryInterface = (*fakeAgentRunRepo)(nil)

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------

func makeRunningRun() *models.AgentRun {
	return &models.AgentRun{
		ID:             "run-running-001",
		TenantID:       "t1",
		AgentProfileID: "agent-1",
		Status:         models.AgentRunStatusRunning,
		TotalSteps:     5,
	}
}

func makeFailedRun() *models.AgentRun {
	return &models.AgentRun{
		ID:             "run-failed-001",
		TenantID:       "t1",
		AgentProfileID: "agent-1",
		TriggerPayload: `{"key":"val"}`,
		Status:         models.AgentRunStatusFailed,
		TotalSteps:     3,
	}
}

func makeCompletedRun() *models.AgentRun {
	return &models.AgentRun{
		ID:             "run-completed-001",
		TenantID:       "t1",
		AgentProfileID: "agent-1",
		Status:         models.AgentRunStatusCompleted,
		TotalSteps:     3,
	}
}

// -----------------------------------------------------------------------------
// tests
// -----------------------------------------------------------------------------

func TestService_NewService(t *testing.T) {
	s := service.NewService(&fakeAgentRunRepo{})
	if s == nil {
		t.Fatal("NewService returned nil")
	}
}

func TestService_TriggerRun(t *testing.T) {
	repo := newFakeAgentRunRepo()
	s := service.NewService(repo)

	totalSteps := 10
	timeoutSec := int64(300)
	req := &models.TriggerRunRequest{
		AgentProfileID: "agent-1",
		TriggerPayload: map[string]interface{}{"task": "test"},
		TotalSteps:     &totalSteps,
		TimeoutSec:     &timeoutSec,
	}

	run, err := s.TriggerRun(context.Background(), "t1", req)
	if err != nil {
		t.Fatalf("TriggerRun error: %v", err)
	}
	if run == nil {
		t.Fatal("TriggerRun returned nil run")
	}
	if run.TenantID != "t1" {
		t.Fatalf("expected tenant t1, got %s", run.TenantID)
	}
	if run.AgentProfileID != "agent-1" {
		t.Fatalf("expected agentProfileID agent-1, got %s", run.AgentProfileID)
	}
	if run.Status != models.AgentRunStatusRunning {
		t.Fatalf("expected status running, got %s", run.Status)
	}
	if run.TotalSteps != 10 {
		t.Fatalf("expected totalSteps 10, got %d", run.TotalSteps)
	}
	if run.TimeoutAt != run.StartedAt+timeoutSec {
		t.Fatalf("expected TimeoutAt == StartedAt + %d", timeoutSec)
	}
	if run.TriggerPayload != `{"task":"test"}` {
		t.Fatalf("unexpected triggerPayload: %s", run.TriggerPayload)
	}
}

func TestService_TriggerRun_Defaults(t *testing.T) {
	repo := newFakeAgentRunRepo()
	s := service.NewService(repo)

	req := &models.TriggerRunRequest{
		AgentProfileID: "agent-2",
	}

	run, err := s.TriggerRun(context.Background(), "t2", req)
	if err != nil {
		t.Fatalf("TriggerRun error: %v", err)
	}
	if run.TotalSteps != 1 {
		t.Fatalf("expected default totalSteps 1, got %d", run.TotalSteps)
	}
	if run.TimeoutAt != run.StartedAt+3600 {
		t.Fatalf("expected default timeout 3600s, got StartedAt=%d TimeoutAt=%d", run.StartedAt, run.TimeoutAt)
	}
	if run.TriggerPayload != "{}" {
		t.Fatalf("expected default triggerPayload {}, got %s", run.TriggerPayload)
	}
}

func TestService_TriggerRun_RejectInvalidJSON(t *testing.T) {
	repo := newFakeAgentRunRepo()
	s := service.NewService(repo)

	req := &models.TriggerRunRequest{
		AgentProfileID: "agent-1",
		TriggerPayload: map[string]interface{}{"invalid": []interface{}{}}, // valid JSON actually; use a channel to make it fail
	}
	req.TriggerPayload["fn"] = func() {}

	_, err := s.TriggerRun(context.Background(), "t1", req)
	if err == nil {
		t.Fatal("expected error when marshalling invalid JSON, got nil")
	}
}

func TestService_GetByID_Found(t *testing.T) {
	repo := newFakeAgentRunRepo(makeRunningRun())
	s := service.NewService(repo)

	run, err := s.GetByID(context.Background(), "run-running-001", "t1")
	if err != nil {
		t.Fatalf("GetByID error: %v", err)
	}
	if run.ID != "run-running-001" {
		t.Fatalf("expected id run-running-001, got %s", run.ID)
	}
	if run.Status != models.AgentRunStatusRunning {
		t.Fatalf("expected status running, got %s", run.Status)
	}
}

func TestService_GetByID_NotFound(t *testing.T) {
	repo := newFakeAgentRunRepo()
	s := service.NewService(repo)

	_, err := s.GetByID(context.Background(), "nonexistent", "t1")
	if !service.IsNotFound(err) {
		t.Fatalf("expected not-found error, got %v", err)
	}
}

func TestService_GetByID_TenantMismatch(t *testing.T) {
	repo := newFakeAgentRunRepo(makeRunningRun()) // tenant t1
	s := service.NewService(repo)

	_, err := s.GetByID(context.Background(), "run-running-001", "t99")
	if !service.IsNotFound(err) {
		t.Fatalf("expected not-found error on tenant mismatch, got %v", err)
	}
}

func TestService_List(t *testing.T) {
	repo := newFakeAgentRunRepo(makeRunningRun(), makeFailedRun(), makeCompletedRun())
	s := service.NewService(repo)

	list, err := s.List(context.Background(), "t1", nil)
	if err != nil {
		t.Fatalf("List error: %v", err)
	}
	if len(list) != 3 {
		t.Fatalf("expected 3 runs, got %d", len(list))
	}
}

func TestService_List_NilFilter(t *testing.T) {
	repo := newFakeAgentRunRepo(makeRunningRun())
	s := service.NewService(repo)

	list, err := s.List(context.Background(), "t1", nil)
	if err != nil {
		t.Fatalf("List error: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("expected 1 run, got %d", len(list))
	}
}

func TestService_Count(t *testing.T) {
	repo := newFakeAgentRunRepo(makeRunningRun(), makeFailedRun())
	s := service.NewService(repo)

	count, err := s.Count(context.Background(), "t1", nil)
	if err != nil {
		t.Fatalf("Count error: %v", err)
	}
	if count != 2 {
		t.Fatalf("expected count 2, got %d", count)
	}
}

func TestService_Cancel_Success(t *testing.T) {
	repo := newFakeAgentRunRepo(makeRunningRun())
	s := service.NewService(repo)

	updated, err := s.Cancel(context.Background(), "run-running-001", "t1")
	if err != nil {
		t.Fatalf("Cancel error: %v", err)
	}
	if updated.Status != models.AgentRunStatusCancelled {
		t.Fatalf("expected status cancelled, got %s", updated.Status)
	}
	if !updated.CompletedAt.Valid {
		t.Fatal("expected CompletedAt to be set")
	}
}

func TestService_Cancel_NotFound(t *testing.T) {
	repo := newFakeAgentRunRepo()
	s := service.NewService(repo)

	_, err := s.Cancel(context.Background(), "nope", "t1")
	if !service.IsNotFound(err) {
		t.Fatalf("expected not-found error, got %v", err)
	}
}

func TestService_Cancel_NotRunning(t *testing.T) {
	repo := newFakeAgentRunRepo(makeCompletedRun()) // status=completed
	s := service.NewService(repo)

	_, err := s.Cancel(context.Background(), "run-completed-001", "t1")
	if err == nil {
		t.Fatal("expected error when cancelling non-running run")
	}
}

func TestService_Retry_Failed(t *testing.T) {
	repo := newFakeAgentRunRepo(makeFailedRun())
	s := service.NewService(repo)

	newRun, err := s.Retry(context.Background(), "run-failed-001", "t1")
	if err != nil {
		t.Fatalf("Retry error: %v", err)
	}
	if newRun == nil {
		t.Fatal("Retry returned nil")
	}
	if newRun.ID == "" {
		t.Fatal("expected new run to have ID")
	}
	if newRun.Status != models.AgentRunStatusRunning {
		t.Fatalf("expected new run status running, got %s", newRun.Status)
	}
	if newRun.AgentProfileID != "agent-1" {
		t.Fatalf("expected agentProfileID agent-1, got %s", newRun.AgentProfileID)
	}
	if newRun.TriggerPayload != `{"key":"val"}` {
		t.Fatalf("unexpected triggerPayload: %s", newRun.TriggerPayload)
	}
	if newRun.TotalSteps != 3 {
		t.Fatalf("expected totalSteps 3, got %d", newRun.TotalSteps)
	}
	if newRun.TimeoutAt != newRun.StartedAt+3600 {
		t.Fatalf("expected default timeout 3600s")
	}
}

func TestService_Retry_Cancelled(t *testing.T) {
	cancelled := makeRunningRun()
	cancelled.Status = models.AgentRunStatusCancelled
	cancelled.ID = "run-cancelled-001"
	cancelled.TotalSteps = 7
	repo := newFakeAgentRunRepo(cancelled)
	s := service.NewService(repo)

	newRun, err := s.Retry(context.Background(), "run-cancelled-001", "t1")
	if err != nil {
		t.Fatalf("Retry error: %v", err)
	}
	if newRun.TotalSteps != 7 {
		t.Fatalf("expected totalSteps 7, got %d", newRun.TotalSteps)
	}
}

func TestService_Retry_NotFound(t *testing.T) {
	repo := newFakeAgentRunRepo()
	s := service.NewService(repo)

	_, err := s.Retry(context.Background(), "nope", "t1")
	if !service.IsNotFound(err) {
		t.Fatalf("expected not-found error, got %v", err)
	}
}

func TestService_Retry_InvalidStatus(t *testing.T) {
	repo := newFakeAgentRunRepo(makeCompletedRun())
	s := service.NewService(repo)

	_, err := s.Retry(context.Background(), "run-completed-001", "t1")
	if err == nil {
		t.Fatal("expected error when retrying a completed run")
	}
}

func TestService_IsNotFound(t *testing.T) {
	if !service.IsNotFound(service.ErrRunNotFound) {
		t.Error("IsNotFound should match ErrRunNotFound")
	}
	if !service.IsNotFound(service.ErrRunNotFoundErr) {
		t.Error("IsNotFound should match ErrRunNotFoundErr")
	}
	if service.IsNotFound(nil) {
		t.Error("IsNotFound should not match nil")
	}
}
