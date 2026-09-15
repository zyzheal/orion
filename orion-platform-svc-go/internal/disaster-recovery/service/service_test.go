package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"regexp"
	"strings"
	"testing"
	"time"

	"go.uber.org/zap/zaptest"
	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/disaster-recovery/models"
	"orion/platform-svc-go/internal/disaster-recovery/orchestrator"
)

// --- Fake repository ---

type fakeRepo struct {
	plans                map[string]*models.DisasterPlan
	runs                 []*models.RecoveryRun
	lastRun              map[string]time.Time
	updates              map[string]interface{}
	getPlanErr           error
	updatePlanErr        error
	createRunErr         error
	updatePlanLastRunErr error
	updateRunErr         error
	getRunErr            error
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
	if r.getPlanErr != nil {
		return nil, r.getPlanErr
	}
	p, ok := r.plans[id]
	if !ok {
		// sentinel.NotFound, not a fresh error: the service decides
		// missing-vs-broken with errors.Is(err, sentinel.NotFound).
		return nil, sentinel.NotFound
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
	if r.updatePlanErr != nil {
		return r.updatePlanErr
	}
	p, ok := r.plans[id]
	if !ok {
		return sentinel.NotFound
	}
	r.updates = updates
	if v, ok := updates["name"]; ok {
		p.Name = v.(string)
	}
	if v, ok := updates["description"]; ok {
		p.Description = v.(string)
	}
	if v, ok := updates["steps"]; ok {
		// The service stores the steps column as a JSON string, so the double
		// must accept a string here too: []string was the pre-fix wire format
		// and it only compiled because the service and the double both
		// disagreed with the real repository.
		p.Steps = v.(string)
	}
	return nil
}

func (r *fakeRepo) UpdatePlanLastRun(_ context.Context, _, id string, t time.Time) error {
	if r.updatePlanLastRunErr != nil {
		return r.updatePlanLastRunErr
	}
	r.lastRun[id] = t
	return nil
}

// The real CreateRun assigns a fresh uuid on every call and INSERTs
// unconditionally, so a second call appends a second row with a different id.
// An "upsert" contract -- what this double had before -- is behaviour the real
// repository cannot produce, and that divergence is what hid the second INSERT
// in RunPlan.
func (r *fakeRepo) CreateRun(_ context.Context, run *models.RecoveryRun) error {
	if r.createRunErr != nil {
		return r.createRunErr
	}
	run.ID = fmt.Sprintf("run-%d", len(r.runs)+1)
	r.runs = append(r.runs, run)
	return nil
}

func (r *fakeRepo) UpdateRun(_ context.Context, _ string, run *models.RecoveryRun) error {
	if r.updateRunErr != nil {
		return r.updateRunErr
	}
	for _, existing := range r.runs {
		if existing.ID == run.ID {
			existing.Status = run.Status
			existing.EndedAt = run.EndedAt
			existing.ErrorMessage = run.ErrorMessage
			return nil
		}
	}
	return sentinel.NotFound
}

func (r *fakeRepo) GetRun(_ context.Context, _, planID, runID string) (*models.RecoveryRun, error) {
	if r.getRunErr != nil {
		return nil, r.getRunErr
	}
	for _, run := range r.runs {
		if run.PlanID == planID && run.ID == runID {
			return run, nil
		}
	}
	return nil, sentinel.NotFound
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

// --- executor fakes ---

func okExecutor(_ context.Context, _ string) (string, error) {
	return "ok", nil
}

func failingExecutor(_ context.Context, _ string) (string, error) {
	return "", errors.New("step failed")
}

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

// A %q dump of []string{"a","b"} is `["a" "b"]` -- valid Go, invalid JSON.
// This is the wire format the pre-fix update path stored, which is why a plan
// could be created and then edited into a shape RunPlan could no longer read.
func TestConvertSteps_RejectsAGoDump(t *testing.T) {
	if steps := convertSteps(fmt.Sprintf("%q", []string{"a", "b"})); steps != nil {
		t.Errorf("expected nil for a Go %q dump, got %v", []string{"a", "b"}, steps)
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

// TestFakeRepo_CreateRunIsNotAnUpsert pins the double to the real contract:
// CreateRun reassigns the id and appends unconditionally. If this stops holding,
// a test of RunPlan can pass while the real repository still double-inserts,
// which is exactly how the defect survived.
func TestFakeRepo_CreateRunIsNotAnUpsert(t *testing.T) {
	repo := newFakeRepo()
	run := &models.RecoveryRun{PlanID: "p1", Status: "running"}
	if err := repo.CreateRun(context.Background(), run); err != nil {
		t.Fatalf("CreateRun: %v", err)
	}
	firstID := run.ID
	if err := repo.CreateRun(context.Background(), run); err != nil {
		t.Fatalf("CreateRun: %v", err)
	}
	if len(repo.runs) != 2 {
		t.Fatalf("a second CreateRun must append a row, got %d rows", len(repo.runs))
	}
	if run.ID == firstID {
		t.Fatal("the real CreateRun reassigns the id on every call; the double must too")
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
	if plan.TenantID != "t1" {
		t.Errorf("tenant was not threaded through: %q", plan.TenantID)
	}
	if plan.Status != "active" {
		t.Errorf("expected status=active, got %q", plan.Status)
	}
}

// The steps column is JSON. The pre-fix update path stored a Go %q dump, so a
// plan could be created and then edited into a shape convertSteps cannot read,
// which made RunPlan silently execute zero steps for an edited plan.
func TestService_CreatePlan_StoresStepsAsJSON(t *testing.T) {
	plan, err := NewService(newFakeRepo()).CreatePlan(context.Background(), "t1",
		models.CreateDisasterPlanRequest{
			Name: "n", Description: "d", Steps: []string{"echo hi", "echo done"},
		})
	if err != nil {
		t.Fatalf("CreatePlan: %v", err)
	}
	if plan.Steps != `["echo hi","echo done"]` {
		t.Fatalf("steps must be stored as JSON, got %q", plan.Steps)
	}
	if len(convertSteps(plan.Steps)) != 2 {
		t.Fatalf("a stored steps column must still be executable, got %q", plan.Steps)
	}
}

// A fresh plan has never run. The pre-fix code wrote time.Time{} -- year 1 AD
// -- into last_run, a garbage value that read like a real timestamp.
func TestService_CreatePlan_NewPlanHasNoLastRun(t *testing.T) {
	plan, err := NewService(newFakeRepo()).CreatePlan(context.Background(), "t1",
		models.CreateDisasterPlanRequest{Name: "n", Description: "d", Steps: []string{"echo hi"}})
	if err != nil {
		t.Fatalf("CreatePlan: %v", err)
	}
	if plan.LastRun != nil {
		t.Fatalf("a fresh plan has no last_run, got %v", *plan.LastRun)
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

// The repository sets only the columns the caller named. UpdatePlan must not
// add a key for an optional field it was not given: an absent key binds as nil
// and the pre-fix statement wrote NULL into name, description, steps and
// status, every one of them NOT NULL in 124.
func TestService_UpdatePlan_SendsOnlyTheFieldsTheCallerSent(t *testing.T) {
	name := "renamed"
	repo := newFakeRepo()
	repo.plans["p1"] = &models.DisasterPlan{
		ID: "p1", Name: "old", Description: "keep me", Steps: `["a"]`, Status: "active",
	}
	plan, err := NewService(repo).UpdatePlan(context.Background(), "t1", "p1",
		models.UpdateDisasterPlanRequest{Name: &name, Steps: []string{"a", "b"}})
	if err != nil {
		t.Fatalf("UpdatePlan: %v", err)
	}
	if plan.Name != "renamed" {
		t.Errorf("expected name='renamed', got %q", plan.Name)
	}
	if plan.Description != "keep me" {
		t.Errorf("the untouched field was overwritten: %q", plan.Description)
	}
	if repo.updates == nil {
		t.Fatal("UpdatePlan never called the repository")
	}
	for _, key := range []string{"description", "status", "id", "tenant_id"} {
		if _, ok := repo.updates[key]; ok {
			t.Fatalf("UpdatePlan sent %q, which the request body did not carry", key)
		}
	}
}

// Steps is required on the update request, so this is the smallest update
// possible: only steps. Both optional fields must be absent from the map, not
// present as nil.
func TestService_UpdatePlan_StepsOnlyOmitsTheOptionalFields(t *testing.T) {
	repo := newFakeRepo()
	repo.plans["p1"] = &models.DisasterPlan{
		ID: "p1", Name: "keep", Description: "keep", Steps: `["a"]`, Status: "active",
	}
	if _, err := NewService(repo).UpdatePlan(context.Background(), "t1", "p1",
		models.UpdateDisasterPlanRequest{Steps: []string{"a", "b"}}); err != nil {
		t.Fatalf("UpdatePlan: %v", err)
	}
	if repo.updates == nil {
		t.Fatal("UpdatePlan never called the repository")
	}
	if len(repo.updates) != 1 {
		t.Fatalf("expected exactly 1 update key, got %v", repo.updates)
	}
	if got, ok := repo.updates["steps"]; !ok {
		t.Fatal("UpdatePlan dropped the steps update")
	} else if got != `["a","b"]` {
		t.Fatalf("steps must be a JSON string, got %q", got)
	}
}

// The JSON shape is asserted structurally as well: the stored value must
// round-trip through json.Unmarshal, which a Go %q dump cannot.
func TestService_UpdatePlan_StepsRoundTripAsJSON(t *testing.T) {
	repo := newFakeRepo()
	repo.plans["p1"] = &models.DisasterPlan{ID: "p1", Name: "n", Description: "d", Steps: `["a"]`, Status: "active"}
	if _, err := NewService(repo).UpdatePlan(context.Background(), "t1", "p1",
		models.UpdateDisasterPlanRequest{Steps: []string{"a", "b"}}); err != nil {
		t.Fatalf("UpdatePlan: %v", err)
	}
	var parsed []string
	if err := json.Unmarshal([]byte(repo.updates["steps"].(string)), &parsed); err != nil {
		t.Fatalf("stored steps is not JSON: %v (value %q)", err, repo.updates["steps"])
	}
	if len(parsed) != 2 || parsed[1] != "b" {
		t.Fatalf("unexpected parsed steps: %v", parsed)
	}
}

func TestService_UpdatePlan_MissingRowReturnsNotFound(t *testing.T) {
	plan, err := NewService(newFakeRepo()).UpdatePlan(context.Background(), "t1", "missing",
		models.UpdateDisasterPlanRequest{Steps: []string{"a"}})
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("expected sentinel.NotFound, got %v", err)
	}
	if plan != nil {
		t.Fatalf("expected a nil plan with an error, got %+v", plan)
	}
}

func TestService_UpdatePlan_DriverErrorIsReturnedAsIs(t *testing.T) {
	outage := errors.New("connection refused")
	repo := newFakeRepo()
	repo.plans["p1"] = &models.DisasterPlan{ID: "p1"}
	repo.getPlanErr = outage

	plan, err := NewService(repo).UpdatePlan(context.Background(), "t1", "p1",
		models.UpdateDisasterPlanRequest{Steps: []string{"a"}})
	if err == nil {
		t.Fatal("expected an error")
	}
	if plan != nil {
		t.Fatalf("expected a nil plan with an error, got %+v", plan)
	}
	if !errors.Is(err, outage) {
		t.Fatalf("driver error was replaced: %v", err)
	}
	if errors.Is(err, sentinel.NotFound) {
		t.Fatal("a driver error must not look like a missing row")
	}
}

func TestService_UpdatePlan_DoesNotUpdateWhenTheRowIsGone(t *testing.T) {
	repo := newFakeRepo()
	if _, err := NewService(repo).UpdatePlan(context.Background(), "t1", "missing",
		models.UpdateDisasterPlanRequest{Steps: []string{"a"}}); err == nil {
		t.Fatal("expected sentinel.NotFound")
	}
	if repo.updates != nil {
		t.Fatal("UpdatePlan ran the update for a row GetPlan could not find")
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
	if run.EndedAt != nil {
		t.Errorf("a run without an orchestrator has no end time, got %v", *run.EndedAt)
	}
	if run.ErrorMessage != "" {
		t.Errorf("expected no error message, got %q", run.ErrorMessage)
	}
}

func TestService_RunPlan_WithOrch_Success(t *testing.T) {
	repo := newFakeRepo()
	repo.plans["p1"] = &models.DisasterPlan{
		ID: "p1", Name: "Test", Steps: `["echo hi"]`, Status: "active",
	}
	svc := NewService(repo)
	svc.SetOrchestrator(orchestrator.NewDROrchestrator(nil, zaptest.NewLogger(t), okExecutor))

	ctx := context.Background()
	run, err := svc.RunPlan(ctx, "t1", "p1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if run.Status != "success" {
		t.Errorf("expected status=success with orchestrator, got %s", run.Status)
	}
	if run.EndedAt == nil {
		t.Error("expected a non-nil EndedAt with orchestrator")
	}
	if run.ErrorMessage != "" {
		t.Errorf("a successful run carries no error message, got %q", run.ErrorMessage)
	}
}

// One execution records one run row. The pre-fix completion path called
// CreateRun a second time, which assigned the run a new id and appended a new
// row, leaving the first row at status='running' forever.
func TestService_RunPlan_WithOrch_SingleRunRow(t *testing.T) {
	repo := newFakeRepo()
	repo.plans["p1"] = &models.DisasterPlan{
		ID: "p1", Name: "Test", Steps: `["echo hi"]`, Status: "active",
	}
	svc := NewService(repo)
	svc.SetOrchestrator(orchestrator.NewDROrchestrator(nil, zaptest.NewLogger(t), okExecutor))

	run, err := svc.RunPlan(context.Background(), "t1", "p1")
	if err != nil {
		t.Fatalf("RunPlan: %v", err)
	}
	if len(repo.runs) != 1 {
		t.Fatalf("one execution must leave exactly one run row, got %d", len(repo.runs))
	}
	if repo.runs[0].ID != run.ID {
		t.Fatalf("the returned run is not the row that was created: %q vs %q", repo.runs[0].ID, run.ID)
	}
	if repo.runs[0].Status != "success" {
		t.Errorf("the run row must carry the outcome, got %q", repo.runs[0].Status)
	}
	if repo.runs[0].EndedAt == nil {
		t.Error("the run row must record when it finished")
	}
}

func TestService_RunPlan_WithOrch_Failure(t *testing.T) {
	repo := newFakeRepo()
	repo.plans["p1"] = &models.DisasterPlan{
		ID: "p1", Name: "Test", Steps: `["false","echo never"]`, Status: "active",
	}
	svc := NewService(repo)
	svc.SetOrchestrator(orchestrator.NewDROrchestrator(nil, zaptest.NewLogger(t), failingExecutor))

	ctx := context.Background()
	run, err := svc.RunPlan(ctx, "t1", "p1")
	if err != nil {
		t.Fatalf("unexpected error from RunPlan: %v", err)
	}
	// autoRollback=true is passed to ExecuteSteps, so the status becomes "rolled-back"
	if run.Status != "rolled-back" {
		t.Errorf("expected status=rolled-back (autoRollback=true), got %s", run.Status)
	}
	if run.EndedAt == nil {
		t.Error("expected a non-nil EndedAt on failure")
	}
	// The pre-fix code discarded the orchestrator error, so a failed run looked
	// identical to one that had never been attempted.
	if run.ErrorMessage == "" {
		t.Fatal("a failed run must record why it failed")
	}
	if !strings.Contains(run.ErrorMessage, "step failed") {
		t.Errorf("error message lost the executor reason: %q", run.ErrorMessage)
	}
}

// The pre-fix completion path discarded this error with `_ =`, so the run was
// reported as finished even when its outcome could not be persisted.
func TestService_RunPlan_WithOrch_UpdateRunErrorIsReturned(t *testing.T) {
	outage := errors.New("connection refused")
	repo := newFakeRepo()
	repo.plans["p1"] = &models.DisasterPlan{
		ID: "p1", Name: "Test", Steps: `["echo hi"]`, Status: "active",
	}
	repo.updateRunErr = outage
	svc := NewService(repo)
	svc.SetOrchestrator(orchestrator.NewDROrchestrator(nil, zaptest.NewLogger(t), okExecutor))

	run, err := svc.RunPlan(context.Background(), "t1", "p1")
	if err == nil {
		t.Fatal("expected an error when the run outcome cannot be persisted")
	}
	if run != nil {
		t.Fatalf("expected a nil run with an error, got %+v", run)
	}
	if !errors.Is(err, outage) {
		t.Fatalf("driver error was replaced: %v", err)
	}
}

func TestService_RunPlan_MissingRowReturnsNotFound(t *testing.T) {
	repo := newFakeRepo()
	run, err := NewService(repo).RunPlan(context.Background(), "t1", "missing")
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("expected sentinel.NotFound, got %v", err)
	}
	if run != nil {
		t.Fatalf("expected a nil run with an error, got %+v", run)
	}
}

func TestService_RunPlan_DriverErrorIsReturnedAsIs(t *testing.T) {
	outage := errors.New("connection refused")
	repo := newFakeRepo()
	repo.plans["p1"] = &models.DisasterPlan{ID: "p1", Steps: `["echo hi"]`}
	repo.getPlanErr = outage

	run, err := NewService(repo).RunPlan(context.Background(), "t1", "p1")
	if err == nil {
		t.Fatal("expected an error")
	}
	if run != nil {
		t.Fatalf("expected a nil run with an error, got %+v", run)
	}
	if !errors.Is(err, outage) {
		t.Fatalf("driver error was replaced: %v", err)
	}
	if errors.Is(err, sentinel.NotFound) {
		t.Fatal("a driver error must not look like a missing plan")
	}
	if len(repo.runs) != 0 {
		t.Fatalf("RunPlan recorded a run for a plan it could not read: %d runs", len(repo.runs))
	}
}

// TestSource_NoTautologicalDisjunction guards the removal of IsNotFound, whose
// body was `errors.Is(err, sentinel.NotFound) || errors.Is(err, sentinel.NotFound)`
// -- both operands the same expression, so the whole function was identical to
// its left side and had no callers. Put the same expression twice in a
// disjunction again and this test says so.
func TestSource_NoTautologicalDisjunction(t *testing.T) {
	b, err := os.ReadFile("service.go")
	if err != nil {
		t.Fatalf("read service.go: %v", err)
	}
	if lines := scanLines(string(b)); len(lines) > 0 {
		t.Fatalf("service.go repeats one disjunct twice on line(s) %v", lines)
	}

	// Positive controls, in the shapes a body can take. The first version of
	// this detector only recognised a leading "return " or "if " at the start
	// of a line, so the one-line form of the same function escaped it and the
	// mutation survived.
	for _, body := range []string{
		"return errors.Is(err, sentinel.NotFound) || errors.Is(err, sentinel.NotFound)",
		"\tif errors.Is(err, sentinel.NotFound) || errors.Is(err, sentinel.NotFound) {",
		"func IsNotFound(err error) bool { return errors.Is(err, sentinel.NotFound) || errors.Is(err, sentinel.NotFound) }",
		"if errors.Is(err, sentinel.NotFound) || errors.Is(err, sentinel.NotFound) { return sentinel.NotFound }",
	} {
		if lines := scanLines(body); len(lines) != 1 {
			t.Fatalf("detector missed %q, got %v", body, lines)
		}
	}

	// Negative controls. Two genuinely different disjuncts, plus foo.bar || bar,
	// where bar is a field of foo rather than a second expression.
	for _, body := range []string{
		"if errors.Is(err, sentinel.NotFound) || errors.Is(err, sql.ErrNoRows) { return nil, err }",
		"x := errors.Is(err, sentinel.NotFound) || errors.Is(err, sql.ErrNoRows)",
		"done := foo.bar || bar",
		"done := foo.Bar() || Bar()",
	} {
		if lines := scanLines(body); len(lines) != 0 {
			t.Fatalf("detector flagged the non-tautology %q, got %v", body, lines)
		}
	}
}

// scanLines reports the lines where both operands of a || disjunction are the
// same expression. Each operand is recovered by walking out from the || until a
// delimiter or a top-level operator, so the detector does not depend on how the
// body is written: a bare return, an if, or the whole signature on one line.
func scanLines(src string) []int {
	out := []int{}
	for idx, line := range strings.Split(src, "\n") {
		for i := 0; ; i++ {
			at := strings.Index(line[i:], "||")
			if at < 0 {
				break
			}
			pos := i + at
			i = pos + 2
			if leftOperand(line[:pos]) == rightOperand(line[pos+2:]) {
				out = append(out, idx)
			}
		}
	}
	return out
}

// identChar reports whether b can sit inside a Go expression: identifier
// characters, dots, delimiters and quotes. Anything else terminates an operand
// at the top level, which is what separates "return X" into "return" and "X".
func identChar(b byte) bool {
	if b >= 'a' && b <= 'z' || b >= 'A' && b <= 'Z' || b >= '0' && b <= '9' {
		return true
	}
	switch b {
	case '_', '.', '(', ')', '[', ']', '{', '}', '"', '\'', '`', '$':
		return true
	}
	return false
}

// leftOperand walks s right-to-left from just before the ||.
func leftOperand(s string) string {
	s = strings.TrimRight(s, " \t")
	if s == "" {
		return ""
	}
	depth := 0
	start := len(s)
	for j := len(s) - 1; j >= 0; j-- {
		c := s[j]
		switch {
		case c == ')' || c == ']' || c == '}':
			depth++
		case c == '(' || c == '[' || c == '{':
			if depth == 0 {
				return strings.TrimSpace(s[j+1:])
			}
			depth--
		case depth == 0 && !identChar(c):
			return strings.TrimSpace(s[j+1:])
		}
		start = j
	}
	return strings.TrimSpace(s[start:])
}

// rightOperand walks s left-to-right from just after the ||.
func rightOperand(s string) string {
	s = strings.TrimLeft(s, " \t")
	if s == "" {
		return ""
	}
	depth := 0
	end := 0
	for j := 0; j < len(s); j++ {
		c := s[j]
		switch {
		case c == '(' || c == '[' || c == '{':
			depth++
		case c == ')' || c == ']' || c == '}':
			if depth == 0 {
				return strings.TrimSpace(s[:j])
			}
			depth--
		case depth == 0 && !identChar(c):
			return strings.TrimSpace(s[:j])
		}
		end = j + 1
	}
	return strings.TrimSpace(s[:end])
}

// TestSource_NoDiscardedErrorAssignments guards the two discarded errors in the
// pre-fix RunPlan: `_ = s.repo.CreateRun(...)` on the completion path and
// `result, _ := s.orch.ExecuteSteps(...)` on the orchestrator call. Either one
// back and this test says so.
func TestSource_NoDiscardedErrorAssignments(t *testing.T) {
	b, err := os.ReadFile("service.go")
	if err != nil {
		t.Fatalf("read service.go: %v", err)
	}
	if lines := scanDiscardedErrors(string(b)); len(lines) > 0 {
		t.Fatalf("service.go discards an error on line(s) %v", lines)
	}

	// Positive controls, in the two shapes the pre-fix code used.
	for _, body := range []string{
		"\t_ = s.repo.CreateRun(ctx, run)",
		"\tresult, _ := s.orch.ExecuteSteps(ctx, planID, drSteps, true)",
		"_, _ := a.Do()",
	} {
		if lines := scanDiscardedErrors(body); len(lines) != 1 {
			t.Fatalf("detector missed %q, got %v", body, lines)
		}
	}

	// Negative controls: named error variables are the point of this fix.
	for _, body := range []string{
		"\tif err := s.repo.UpdateRun(ctx, tenantID, run); err != nil {",
		"\tresult, execErr := s.orch.ExecuteSteps(ctx, planID, drSteps, true)",
		"\tstepsJSON, err := json.Marshal(req.Steps)",
	} {
		if lines := scanDiscardedErrors(body); len(lines) != 0 {
			t.Fatalf("detector flagged the named binding %q, got %v", body, lines)
		}
	}
}

var (
	reBareBlank = regexp.MustCompile(`^\s*_\s*(?:=|:=)`)
	reTupBlank  = regexp.MustCompile(`,\s*_\s*:=`)
)

// scanDiscardedErrors reports the lines that assign to a blank identifier,
// either as a bare statement or as the second position of a tuple.
func scanDiscardedErrors(src string) []int {
	out := []int{}
	for idx, line := range strings.Split(src, "\n") {
		if reBareBlank.MatchString(line) || reTupBlank.MatchString(line) {
			out = append(out, idx+1)
		}
	}
	return out
}
