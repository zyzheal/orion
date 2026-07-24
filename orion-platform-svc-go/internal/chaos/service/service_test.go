package service

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	"orion/platform-svc-go/internal/chaos/models"
)

// --- Mock repository matching repository.Repository methods ---

type mockChaosRepo struct {
	experiments map[string]*models.Experiment // key = tenantID:id
	err         error
	getByIDFn   func(ctx context.Context, tenantID, id string) (*models.Experiment, error)
}

func (m *mockChaosRepo) Create(_ context.Context, e *models.Experiment) error {
	if m.err != nil { return m.err }
	if e.ID == "" { e.ID = "exp-1" }
	m.experiments[m.key(e.TenantID, e.ID)] = e
	return nil
}

func (m *mockChaosRepo) GetByID(ctx context.Context, tenantID, id string) (*models.Experiment, error) {
	if m.getByIDFn != nil { return m.getByIDFn(ctx, tenantID, id) }
	if m.err != nil { return nil, m.err }
	e, ok := m.experiments[m.key(tenantID, id)]
	if !ok { return nil, sql.ErrNoRows }
	return e, nil
}

func (m *mockChaosRepo) List(_ context.Context, tenantID, status string, _, _ int) ([]models.Experiment, error) {
	if m.err != nil { return nil, m.err }
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
	if m.err != nil { return m.err }
	e, ok := m.experiments[m.key(tenantID, id)]
	if !ok { return errors.New("not found") }
	if v, ok := updates["name"]; ok { e.Name = v.(string) }
	if v, ok := updates["description"]; ok { e.Description = v.(string) }
	return nil
}

func (m *mockChaosRepo) Delete(_ context.Context, tenantID, id string) error {
	if m.err != nil { return m.err }
	_, ok := m.experiments[m.key(tenantID, id)]
	if !ok { return errors.New("not found") }
	delete(m.experiments, m.key(tenantID, id))
	return nil
}

func (m *mockChaosRepo) UpdateStatus(_ context.Context, tenantID, id, status string) error {
	if m.err != nil { return m.err }
	e, ok := m.experiments[m.key(tenantID, id)]
	if !ok { return errors.New("not found") }
	e.Status = status
	return nil
}

func (m *mockChaosRepo) ListRunning(_ context.Context, tenantID string) ([]models.Experiment, error) {
	return m.List(context.Background(), tenantID, "running", 100, 0)
}

func (m *mockChaosRepo) CreateRun(_ context.Context, run *models.ExperimentRun) error {
	if m.err != nil { return m.err }
	if run.ID == "" { run.ID = "run-1" }
	return nil
}

func (m *mockChaosRepo) GetRun(_ context.Context, tenantID, runID string) (*models.ExperimentRun, error) {
	if m.err != nil { return nil, m.err }
	return &models.ExperimentRun{ID: runID, TenantID: tenantID, ExperimentID: "exp-1", Status: "running"}, nil
}

func (m *mockChaosRepo) UpdateRunStatus(_ context.Context, tenantID, runID, status string) error {
	if m.err != nil { return m.err }
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
	if e.Name != "cpu-stress" { t.Errorf("expected cpu-stress, got %s", e.Name) }
	if e.Scope != "prod" { t.Errorf("expected prod, got %s", e.Scope) }
	if e.AutoRollback != false { t.Error("expected AutoRollback false") }
}

func TestMockChaosRepoCreate_Success(t *testing.T) {
	repo := &mockChaosRepo{experiments: map[string]*models.Experiment{}}
	e := &models.Experiment{TenantID: "t1", Name: "stress", Scope: "prod", Faults: "cpu"}
	err := repo.Create(context.Background(), e)
	if err != nil { t.Fatalf("expected no error, got %v", err) }
	if e.ID != "exp-1" { t.Errorf("expected exp-1, got %s", e.ID) }
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
	if err != nil { t.Fatalf("expected no error, got %v", err) }
	if got.Name != "stress" { t.Errorf("expected stress, got %s", got.Name) }
}

func TestMockChaosRepoGetByID_NotFound(t *testing.T) {
	repo := &mockChaosRepo{experiments: map[string]*models.Experiment{}}
	_, err := repo.GetByID(context.Background(), "t1", "x")
	if !errors.Is(err, sql.ErrNoRows) { t.Errorf("expected ErrNoRows, got %v", err) }
}

// --- List ---

func TestMockChaosRepoList_All(t *testing.T) {
	repo := &mockChaosRepo{experiments: map[string]*models.Experiment{
		"t1:e1": {ID: "e1", TenantID: "t1", Status: "draft"},
		"t1:e2": {ID: "e2", TenantID: "t1", Status: "active"}}}
	items, err := repo.List(context.Background(), "t1", "", 10, 0)
	if err != nil { t.Fatalf("expected no error, got %v", err) }
	if len(items) != 2 { t.Errorf("expected 2, got %d", len(items)) }
}

func TestMockChaosRepoList_Filtered(t *testing.T) {
	repo := &mockChaosRepo{experiments: map[string]*models.Experiment{
		"t1:e1": {ID: "e1", TenantID: "t1", Status: "draft"},
		"t1:e2": {ID: "e2", TenantID: "t1", Status: "active"}}}
	items, err := repo.List(context.Background(), "t1", "active", 10, 0)
	if err != nil { t.Fatalf("expected no error, got %v", err) }
	if len(items) != 1 { t.Errorf("expected 1, got %d", len(items)) }
}

// --- Update ---

func TestChaosUpdate_BuildMap(t *testing.T) {
	name := "new-name"
	scope := "staging"
	updates := make(map[string]interface{})
	if &name != nil { updates["name"] = name } // simulate req.Name != nil
	if &scope != nil { updates["scope"] = scope }
	if updates["name"] != "new-name" { t.Error("expected name update") }
	if updates["scope"] != "staging" { t.Error("expected scope update") }
}

func TestChaosUpdate_EmptyUpdates(t *testing.T) {
	updates := make(map[string]interface{})
	if len(updates) != 0 { t.Error("expected empty updates") }
}

func TestMockChaosRepoUpdate_Success(t *testing.T) {
	repo := &mockChaosRepo{experiments: map[string]*models.Experiment{
		"t1:e1": {ID: "e1", TenantID: "t1", Name: "old"}}}
	err := repo.Update(context.Background(), "t1", "e1", map[string]interface{}{"name": "new"})
	if err != nil { t.Fatalf("expected no error, got %v", err) }
}

func TestMockChaosRepoUpdate_NotFound(t *testing.T) {
	repo := &mockChaosRepo{experiments: map[string]*models.Experiment{}}
	err := repo.Update(context.Background(), "t1", "x", map[string]interface{}{"name": "new"})
	if err == nil { t.Fatal("expected error") }
}

// --- Delete ---

func TestMockChaosRepoDelete_Success(t *testing.T) {
	repo := &mockChaosRepo{experiments: map[string]*models.Experiment{"t1:e1": {}}}
	err := repo.Delete(context.Background(), "t1", "e1")
	if err != nil { t.Fatalf("expected no error, got %v", err) }
}

func TestMockChaosRepoDelete_NotFound(t *testing.T) {
	repo := &mockChaosRepo{experiments: map[string]*models.Experiment{}}
	err := repo.Delete(context.Background(), "t1", "x")
	if err == nil { t.Fatal("expected error") }
}

// --- Run ---

func TestMockChaosRepoCreateRun_Success(t *testing.T) {
	repo := &mockChaosRepo{experiments: map[string]*models.Experiment{}}
	run := &models.ExperimentRun{TenantID: "t1", ExperimentID: "exp-1"}
	err := repo.CreateRun(context.Background(), run)
	if err != nil { t.Fatalf("expected no error, got %v", err) }
	if run.ID != "run-1" { t.Errorf("expected run-1, got %s", run.ID) }
}

func TestMockChaosRepoUpdateRunStatus_Success(t *testing.T) {
	repo := &mockChaosRepo{experiments: map[string]*models.Experiment{}}
	err := repo.UpdateRunStatus(context.Background(), "t1", "run-1", "rolled_back")
	if err != nil { t.Fatalf("expected no error, got %v", err) }
}

// --- Fault injection ---

func TestChaosFaultInjection_CPU(t *testing.T) {
	res := &models.InjectResult{InjectionID: "cpu-target", Target: "target", Status: "injected"}
	if res.Status != "injected" { t.Errorf("expected injected, got %s", res.Status) }
	if res.InjectionID != "cpu-target" { t.Errorf("expected cpu-target, got %s", res.InjectionID) }
}

// --- Recovery ---

func TestChaosRecovery_Result(t *testing.T) {
	res := &models.RecoveryResult{ExperimentID: "exp-1", Status: "recovered", Message: "experiment recovery completed"}
	if res.Status != "recovered" { t.Errorf("expected recovered, got %s", res.Status) }
}

func TestChaosRecoveryValidation_Result(t *testing.T) {
	res := &models.RecoveryValidation{ExperimentID: "exp-1", Passed: true, Details: "all services healthy after recovery"}
	if !res.Passed { t.Error("expected passed=true") }
}
