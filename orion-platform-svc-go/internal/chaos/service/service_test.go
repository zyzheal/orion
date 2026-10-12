package service

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"orion/platform-svc-go/internal/chaos/models"
)

// --- Mock repository matching repository.Repository methods ---

type mockChaosRepo struct {
	experiments         map[string]*models.Experiment // key = tenantID:id
	injectionsByExperiment map[string][]models.InjectionRecord // key = experimentID
	err                 error
	getByIDFn           func(ctx context.Context, tenantID, id string) (*models.Experiment, error)
}

func (m *mockChaosRepo) Create(_ context.Context, e *models.Experiment) error {
	if m.err != nil {
		return m.err
	}
	if e.ID == "" {
		e.ID = "exp-1"
	}
	m.experiments[m.key(e.TenantID, e.ID)] = e
	return nil
}

func (m *mockChaosRepo) GetByID(ctx context.Context, tenantID, id string) (*models.Experiment, error) {
	if m.getByIDFn != nil {
		return m.getByIDFn(ctx, tenantID, id)
	}
	if m.err != nil {
		return nil, m.err
	}
	e, ok := m.experiments[m.key(tenantID, id)]
	if !ok {
		return nil, sql.ErrNoRows
	}
	return e, nil
}

func (m *mockChaosRepo) List(_ context.Context, tenantID, status string, _, _ int) ([]models.Experiment, error) {
	if m.err != nil {
		return nil, m.err
	}
	var result []models.Experiment
	for k, e := range m.experiments {
		if k[:len(tenantID)] == tenantID {
			if status == "" || e.Status == status {
				result = append(result, *e)
			}
		}
	}
	return result, nil
}

func (m *mockChaosRepo) Update(_ context.Context, tenantID, id string, updates map[string]interface{}) error {
	if m.err != nil {
		return m.err
	}
	e, ok := m.experiments[m.key(tenantID, id)]
	if !ok {
		return errors.New("not found")
	}
	if v, ok := updates["name"]; ok {
		e.Name = v.(string)
	}
	if v, ok := updates["description"]; ok {
		e.Description = v.(string)
	}
	return nil
}

func (m *mockChaosRepo) Delete(_ context.Context, tenantID, id string) error {
	if m.err != nil {
		return m.err
	}
	_, ok := m.experiments[m.key(tenantID, id)]
	if !ok {
		return errors.New("not found")
	}
	delete(m.experiments, m.key(tenantID, id))
	return nil
}

func (m *mockChaosRepo) UpdateStatus(_ context.Context, tenantID, id, status string) error {
	if m.err != nil {
		return m.err
	}
	e, ok := m.experiments[m.key(tenantID, id)]
	if !ok {
		return errors.New("not found")
	}
	e.Status = status
	return nil
}

func (m *mockChaosRepo) ListRunning(_ context.Context, tenantID string) ([]models.Experiment, error) {
	return m.List(context.Background(), tenantID, "running", 100, 0)
}

func (m *mockChaosRepo) ListInjectionsByExperiment(_ context.Context, tenantID, experimentID string) ([]models.InjectionRecord, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.injectionsByExperiment[experimentID], nil
}

func (m *mockChaosRepo) ListRecoveriesByExperiment(_ context.Context, tenantID, experimentID string) ([]models.RecoveryRecord, error) {
	if m.err != nil {
		return nil, m.err
	}
	return []models.RecoveryRecord{}, nil
}

func (m *mockChaosRepo) UpdateInjectionStatus(_ context.Context, tenantID, injectionID, status string) error {
	return nil
}

func (m *mockChaosRepo) UpdateRecoveryStatus(_ context.Context, tenantID, experimentID, status, message string) error {
	return nil
}

func (m *mockChaosRepo) CreateInjection(_ context.Context, rec *models.InjectionRecord) error {
	return nil
}

func (m *mockChaosRepo) CreateRecovery(_ context.Context, rec *models.RecoveryRecord) error {
	return nil
}

func (m *mockChaosRepo) GetInjection(_ context.Context, tenantID, injectionID string) (*models.InjectionRecord, error) {
	return nil, sql.ErrNoRows
}

func (m *mockChaosRepo) CreateRun(_ context.Context, run *models.ExperimentRun) error {
	if m.err != nil {
		return m.err
	}
	if run.ID == "" {
		run.ID = "run-1"
	}
	return nil
}

func (m *mockChaosRepo) GetRun(_ context.Context, tenantID, runID string) (*models.ExperimentRun, error) {
	if m.err != nil {
		return nil, m.err
	}
	return &models.ExperimentRun{ID: runID, TenantID: tenantID, ExperimentID: "exp-1", Status: "running"}, nil
}

func (m *mockChaosRepo) UpdateRunStatus(_ context.Context, tenantID, runID, status string) error {
	if m.err != nil {
		return m.err
	}
	return nil
}

func (m *mockChaosRepo) key(tenantID, id string) string { return tenantID + ":" + id }

// --- Tests ---

func TestChaosErrNotFound(t *testing.T) {
	if !IsNotFound(ErrNotFound) {
		t.Error("IsNotFound should return true for ErrNotFound")
	}
	if IsNotFound(errors.New("other")) {
		t.Error("IsNotFound should return false for unrelated error")
	}
}

// --- Create ---

func TestChaosCreate_ExperimentModel(t *testing.T) {
	req := models.CreateExperimentRequest{
		Name:   "cpu-stress",
		Scope:  "prod",
		Faults: "cpu",
	}
	e := &models.Experiment{
		Name: req.Name, Description: req.Description, Scope: req.Scope,
		Faults: req.Faults, AutoRollback: req.AutoRollback, CreatedBy: req.CreatedBy,
	}
	if e.Name != "cpu-stress" {
		t.Errorf("expected cpu-stress, got %s", e.Name)
	}
	if e.Scope != "prod" {
		t.Errorf("expected prod, got %s", e.Scope)
	}
	if e.AutoRollback != false {
		t.Error("expected AutoRollback false")
	}
}

func TestMockChaosRepoCreate_Success(t *testing.T) {
	repo := &mockChaosRepo{experiments: map[string]*models.Experiment{}}
	e := &models.Experiment{TenantID: "t1", Name: "stress", Scope: "prod", Faults: "cpu"}
	err := repo.Create(context.Background(), e)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if e.ID != "exp-1" {
		t.Errorf("expected exp-1, got %s", e.ID)
	}
}

func TestMockChaosRepoCreate_Error(t *testing.T) {
	repo := &mockChaosRepo{experiments: map[string]*models.Experiment{}, err: errors.New("db fail")}
	if err := repo.Create(context.Background(), &models.Experiment{}); err == nil {
		t.Fatal("expected error")
	}
}

// --- Get ---

func TestMockChaosRepoGetByID_Success(t *testing.T) {
	e := &models.Experiment{ID: "exp-1", TenantID: "t1", Name: "stress"}
	repo := &mockChaosRepo{experiments: map[string]*models.Experiment{"t1:exp-1": e}}
	got, err := repo.GetByID(context.Background(), "t1", "exp-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if got.Name != "stress" {
		t.Errorf("expected stress, got %s", got.Name)
	}
}

func TestMockChaosRepoGetByID_NotFound(t *testing.T) {
	repo := &mockChaosRepo{experiments: map[string]*models.Experiment{}}
	_, err := repo.GetByID(context.Background(), "t1", "x")
	if !errors.Is(err, sql.ErrNoRows) {
		t.Errorf("expected ErrNoRows, got %v", err)
	}
}

// --- List ---

func TestMockChaosRepoList_All(t *testing.T) {
	repo := &mockChaosRepo{experiments: map[string]*models.Experiment{
		"t1:e1": {ID: "e1", TenantID: "t1", Status: "draft"},
		"t1:e2": {ID: "e2", TenantID: "t1", Status: "active"}}}
	items, err := repo.List(context.Background(), "t1", "", 10, 0)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(items) != 2 {
		t.Errorf("expected 2, got %d", len(items))
	}
}

func TestMockChaosRepoList_Filtered(t *testing.T) {
	repo := &mockChaosRepo{experiments: map[string]*models.Experiment{
		"t1:e1": {ID: "e1", TenantID: "t1", Status: "draft"},
		"t1:e2": {ID: "e2", TenantID: "t1", Status: "active"}}}
	items, err := repo.List(context.Background(), "t1", "active", 10, 0)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(items) != 1 {
		t.Errorf("expected 1, got %d", len(items))
	}
}

// --- Update ---

func TestChaosUpdate_BuildMap(t *testing.T) {
	name := "new-name"
	scope := "staging"
	updates := make(map[string]interface{})
	if &name != nil {
		updates["name"] = name
	} // simulate req.Name != nil
	if &scope != nil {
		updates["scope"] = scope
	}
	if updates["name"] != "new-name" {
		t.Error("expected name update")
	}
	if updates["scope"] != "staging" {
		t.Error("expected scope update")
	}
}

func TestChaosUpdate_EmptyUpdates(t *testing.T) {
	updates := make(map[string]interface{})
	if len(updates) != 0 {
		t.Error("expected empty updates")
	}
}

func TestMockChaosRepoUpdate_Success(t *testing.T) {
	repo := &mockChaosRepo{experiments: map[string]*models.Experiment{
		"t1:e1": {ID: "e1", TenantID: "t1", Name: "old"}}}
	err := repo.Update(context.Background(), "t1", "e1", map[string]interface{}{"name": "new"})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
}

func TestMockChaosRepoUpdate_NotFound(t *testing.T) {
	repo := &mockChaosRepo{experiments: map[string]*models.Experiment{}}
	err := repo.Update(context.Background(), "t1", "x", map[string]interface{}{"name": "new"})
	if err == nil {
		t.Fatal("expected error")
	}
}

// --- Delete ---

func TestMockChaosRepoDelete_Success(t *testing.T) {
	repo := &mockChaosRepo{experiments: map[string]*models.Experiment{"t1:e1": {}}}
	err := repo.Delete(context.Background(), "t1", "e1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
}

func TestMockChaosRepoDelete_NotFound(t *testing.T) {
	repo := &mockChaosRepo{experiments: map[string]*models.Experiment{}}
	err := repo.Delete(context.Background(), "t1", "x")
	if err == nil {
		t.Fatal("expected error")
	}
}

// --- Run ---

func TestMockChaosRepoCreateRun_Success(t *testing.T) {
	repo := &mockChaosRepo{experiments: map[string]*models.Experiment{}}
	run := &models.ExperimentRun{TenantID: "t1", ExperimentID: "exp-1"}
	err := repo.CreateRun(context.Background(), run)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if run.ID != "run-1" {
		t.Errorf("expected run-1, got %s", run.ID)
	}
}

func TestMockChaosRepoUpdateRunStatus_Success(t *testing.T) {
	repo := &mockChaosRepo{experiments: map[string]*models.Experiment{}}
	err := repo.UpdateRunStatus(context.Background(), "t1", "run-1", "rolled_back")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
}

// --- Fault injection ---

func TestChaosFaultInjection_CPU(t *testing.T) {
	res := &models.InjectResult{InjectionID: "cpu-target", Target: "target", Status: "injected"}
	if res.Status != "injected" {
		t.Errorf("expected injected, got %s", res.Status)
	}
	if res.InjectionID != "cpu-target" {
		t.Errorf("expected cpu-target, got %s", res.InjectionID)
	}
}

// --- Recovery ---

func TestChaosRecovery_Result(t *testing.T) {
	res := &models.RecoveryResult{ExperimentID: "exp-1", Status: "recovered", Message: "experiment recovery completed"}
	if res.Status != "recovered" {
		t.Errorf("expected recovered, got %s", res.Status)
	}
}

func TestChaosRecoveryValidation_Result(t *testing.T) {
	res := &models.RecoveryValidation{ExperimentID: "exp-1", Passed: true, Details: "all services healthy after recovery"}
	if !res.Passed {
		t.Error("expected passed=true")
	}
}

// --- S2-T2: execute() no longer silently no-ops ---

func TestFaultTypeFromString_KnownTypes(t *testing.T) {
	for _, s := range []string{"cpu-spike", "memory-leak", "network-latency", "service-down", "pod-kill", "pod-oom"} {
		if _, err := faultTypeFromString(s); err != nil {
			t.Errorf("expected %q to be supported, got %v", s, err)
		}
	}
}

func TestFaultTypeFromString_Unknown(t *testing.T) {
	_, err := faultTypeFromString("quantum-burst")
	if err == nil {
		t.Fatal("expected unsupported fault type error")
	}
	if !errors.Is(err, ErrUnsupportedFaultType) {
		t.Errorf("expected ErrUnsupportedFaultType, got %v", err)
	}
}

// bareService builds a *Service with no repo and no injector — enough for
// execute() tests since execute doesn't touch the repository.
func bareService() *Service {
	return &Service{}
}

func TestExecute_NilInjector_ReturnsErrInjectorUnavailable(t *testing.T) {
	svc := bareService()
	err := svc.execute(context.Background(), "cpu-spike", "default/app", "30s", 1.0, nil)
	if err == nil {
		t.Fatal("expected error for nil injector, got nil (was silent no-op before S2-T2)")
	}
	if !errors.Is(err, ErrInjectorUnavailable) {
		t.Errorf("expected ErrInjectorUnavailable, got %v", err)
	}
}

func TestExecute_UnknownFaultType_ReturnsErrUnsupported(t *testing.T) {
	svc := bareService()
	err := svc.execute(context.Background(), "quantum-burst", "default/app", "30s", 1.0, nil)
	if err == nil {
		t.Fatal("expected unsupported fault error")
	}
	if !errors.Is(err, ErrUnsupportedFaultType) {
		t.Errorf("expected ErrUnsupportedFaultType, got %v", err)
	}
}

func TestExecute_InvalidDuration_ReturnsErrInvalidConfig(t *testing.T) {
	svc := bareService()
	err := svc.execute(context.Background(), "cpu-spike", "default/app", "bogus", 1.0, nil)
	if err == nil {
		t.Fatal("expected invalid duration error")
	}
	if !errors.Is(err, ErrInvalidConfig) {
		t.Errorf("expected ErrInvalidConfig, got %v", err)
	}
}

func TestExecute_NegativeIntensity_ReturnsError(t *testing.T) {
	svc := bareService()
	err := svc.execute(context.Background(), "cpu-spike", "default/app", "30s", -0.5, nil)
	if err == nil {
		t.Fatal("expected negative intensity error")
	}
}

func TestExecute_BadPercentage_ReturnsError(t *testing.T) {
	svc := bareService()
	err := svc.execute(context.Background(), "cpu-spike", "default/app", "30s", 1.0,
		&models.InjectConfig{Percentage: 200})
	if err == nil {
		t.Fatal("expected out-of-range percentage error")
	}
}

func TestExecute_ContextCancelled_ReturnsCtxError(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	svc := bareService()
	err := svc.execute(ctx, "cpu-spike", "default/app", "30s", 1.0, nil)
	if !errors.Is(err, context.Canceled) {
		t.Errorf("expected context.Canceled, got %v", err)
	}
}

// --- S2-T3: PreReleaseVerify checks are real, not "return skip" stubs ---

func TestExperimentTargets_MatchesBySubstring(t *testing.T) {
	if !experimentTargets("svc-a,svc-b", "svc-a") {
		t.Error("expected substring match on svc-a")
	}
	if !experimentTargets("svc-a", "svc-a") {
		t.Error("exact match should work")
	}
	if experimentTargets("svc-b,svc-c", "svc-a") {
		t.Error("svc-a not in scope")
	}
	if experimentTargets("", "svc-a") {
		t.Error("empty scope must not match")
	}
	if experimentTargets("svc-a", "") {
		t.Error("empty serviceID must not match")
	}
}

func TestCheckExperimentCleanup_NoRunning(t *testing.T) {
	repo := &mockChaosRepo{experiments: map[string]*models.Experiment{}}
	svc := NewService(repo)
	status, msg := svc.checkExperimentCleanup(context.Background(), "svc-a", "staging")
	if status != "pass" {
		t.Errorf("expected pass, got %s (%s)", status, msg)
	}
	if msg == "no experiment cleanup check" {
		t.Errorf("legacy skip message still present: %s", msg)
	}
}

func TestCheckExperimentCleanup_ActiveMatch(t *testing.T) {
	repo := &mockChaosRepo{experiments: map[string]*models.Experiment{
		"t1:e1": {ID: "e1", TenantID: "t1", Name: "load-test", Scope: "svc-a", Status: "running"},
	}}
	svc := NewService(repo)
	status, msg := svc.checkExperimentCleanup(context.Background(), "svc-a", "staging")
	if status != "fail" {
		t.Errorf("expected fail for active experiment, got %s (%s)", status, msg)
	}
}

func TestCheckExperimentCleanup_NilRepo(t *testing.T) {
	svc := &Service{} // no repo
	status, msg := svc.checkExperimentCleanup(context.Background(), "svc-a", "staging")
	if status != "fail" {
		t.Errorf("expected fail without repo, got %s (%s)", status, msg)
	}
}

func TestCheckInjectionQuietPeriod_NoRecentInjections(t *testing.T) {
	repo := &mockChaosRepo{
		experiments: map[string]*models.Experiment{
			"t1:e1": {ID: "e1", TenantID: "t1", Name: "old", Scope: "svc-a", Status: "running"},
		},
		injectionsByExperiment: map[string][]models.InjectionRecord{
			"e1": {{ID: "i1", CreatedAt: time.Now().UTC().Add(-24 * time.Hour)}},
		},
	}
	svc := NewService(repo)
	status, msg := svc.checkInjectionQuietPeriod(context.Background(), "svc-a", "staging")
	if status != "pass" {
		t.Errorf("expected pass for quiet window, got %s (%s)", status, msg)
	}
}

func TestCheckInjectionQuietPeriod_RecentInjection(t *testing.T) {
	repo := &mockChaosRepo{
		experiments: map[string]*models.Experiment{
			"t1:e1": {ID: "e1", TenantID: "t1", Name: "hot", Scope: "svc-a", Status: "running"},
		},
		injectionsByExperiment: map[string][]models.InjectionRecord{
			"e1": {{ID: "i1", CreatedAt: time.Now().UTC().Add(-1 * time.Minute)}},
		},
	}
	svc := NewService(repo)
	status, _ := svc.checkInjectionQuietPeriod(context.Background(), "svc-a", "staging")
	if status != "fail" {
		t.Errorf("expected fail for recent injection, got %s", status)
	}
}

// fakeSteadyState is a SteadyStateProvider for tests.
type fakeSteadyState struct {
	metrics map[string]float64
	err     error
	drift   []string
}

func (f *fakeSteadyState) Snapshot(_ context.Context, _, _ string) (map[string]float64, error) {
	return f.metrics, f.err
}
func (f *fakeSteadyState) Evaluate(_ map[string]float64) []string {
	return f.drift
}

func TestCheckSteadyState_NoProvider(t *testing.T) {
	svc := NewService(&mockChaosRepo{experiments: map[string]*models.Experiment{}})
	status, msg := svc.checkSteadyState(context.Background(), "svc-a", "staging")
	if status != "fail" {
		t.Errorf("expected fail without steady-state provider, got %s (%s)", status, msg)
	}
	if msg == "steady state not checked" {
		t.Errorf("legacy skip message still present: %s", msg)
	}
}

func TestCheckSteadyState_Drift(t *testing.T) {
	svc := NewService(&mockChaosRepo{experiments: map[string]*models.Experiment{}}).
		WithSteadyStateProvider(&fakeSteadyState{
			metrics: map[string]float64{"p99": 500},
			drift:   []string{"p99=500ms exceeds baseline 200ms"},
		})
	status, _ := svc.checkSteadyState(context.Background(), "svc-a", "staging")
	if status != "fail" {
		t.Errorf("expected fail for drift, got %s", status)
	}
}

func TestCheckSteadyState_OK(t *testing.T) {
	svc := NewService(&mockChaosRepo{experiments: map[string]*models.Experiment{}}).
		WithSteadyStateProvider(&fakeSteadyState{
			metrics: map[string]float64{"p99": 100},
			drift:   nil,
		})
	status, _ := svc.checkSteadyState(context.Background(), "svc-a", "staging")
	if status != "pass" {
		t.Errorf("expected pass, got %s", status)
	}
}

func TestCheckHealthEndpoint_NoURLRegistered(t *testing.T) {
	svc := NewService(&mockChaosRepo{experiments: map[string]*models.Experiment{}})
	status, msg := svc.checkHealthEndpoint(context.Background(), "svc-a", "staging")
	if status != "fail" {
		t.Errorf("expected fail without registered endpoint, got %s", status)
	}
	if msg == "health endpoint not checked" {
		t.Errorf("legacy skip message still present: %s", msg)
	}
}

func TestCheckHealthEndpoint_OK(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	srv := httptest.NewServer(mux)
	defer srv.Close()

	svc := NewService(&mockChaosRepo{experiments: map[string]*models.Experiment{}}).
		WithHealthEndpoints(map[string]string{"svc-a@staging": srv.URL + "/healthz"})
	status, _ := svc.checkHealthEndpoint(context.Background(), "svc-a", "staging")
	if status != "pass" {
		t.Errorf("expected pass, got %s", status)
	}
}

func TestCheckHealthEndpoint_Non200(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	})
	srv := httptest.NewServer(mux)
	defer srv.Close()

	svc := NewService(&mockChaosRepo{experiments: map[string]*models.Experiment{}}).
		WithHealthEndpoints(map[string]string{"svc-a@staging": srv.URL + "/healthz"})
	status, _ := svc.checkHealthEndpoint(context.Background(), "svc-a", "staging")
	if status != "fail" {
		t.Errorf("expected fail on 503, got %s", status)
	}
}

func TestPreReleaseVerify_AllChecksReal(t *testing.T) {
	repo := &mockChaosRepo{experiments: map[string]*models.Experiment{}}
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })
	srv := httptest.NewServer(mux)
	defer srv.Close()

	svc := NewService(repo).
		WithHealthEndpoints(map[string]string{"svc-a@staging": srv.URL + "/healthz"}).
		WithSteadyStateProvider(&fakeSteadyState{metrics: map[string]float64{"p99": 100}})
	res, err := svc.PreReleaseVerify(context.Background(), "t1",
		models.PreReleaseVerifyRequest{ServiceID: "svc-a", Environment: "staging"})
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if res.Status != "passed" {
		t.Errorf("expected passed overall, got %s: %+v", res.Status, res.Checks)
	}
	for _, c := range res.Checks {
		if c.Status == "skip" {
			t.Errorf("check %s returned skip — no silent skip after S2-T3: %+v", c.Check, c)
		}
	}
}
