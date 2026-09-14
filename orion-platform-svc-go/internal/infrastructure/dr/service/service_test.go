package service

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/infrastructure/dr/models"
)

// fakeDrRepo is the in-memory RepositoryInterface. Every method records its
// arguments so a test can prove the service called the right method with the
// right values, and every read can be made to return either sql.ErrNoRows or an
// arbitrary storage error so both branches of mapRead are reachable.
type fakeDrRepo struct {
	plans       map[string]*models.DRPlan
	tests       map[string]*models.FailoverTest
	backups     map[string]*models.BackupConfig
	policies    map[string]*models.DRPolicy
	deletedPlan []string

	bestEffortErr error
	readErr       error
	listPlansErr  error
	testsErr      error
	createTestErr error
	writeErr      error
	countErr      error
}

func newFakeDrRepo() *fakeDrRepo {
	return &fakeDrRepo{
		plans:    map[string]*models.DRPlan{},
		tests:    map[string]*models.FailoverTest{},
		backups:  map[string]*models.BackupConfig{},
		policies: map[string]*models.DRPolicy{},
	}
}

// planByID returns sql.ErrNoRows for a missing key and readErr for a storage
// failure, so the two outcomes mapRead distinguishes are separately injectable.
func (f *fakeDrRepo) planByID(id string) (*models.DRPlan, error) {
	if f.readErr != nil {
		return nil, f.readErr
	}
	p, ok := f.plans[id]
	if !ok {
		return nil, sql.ErrNoRows
	}
	return p, nil
}

func (f *fakeDrRepo) CreatePlan(ctx context.Context, p *models.DRPlan) error {
	if f.writeErr != nil {
		return f.writeErr
	}
	f.plans[p.ID] = p
	return nil
}
func (f *fakeDrRepo) GetPlanByID(ctx context.Context, tenantID, id string) (*models.DRPlan, error) {
	return f.planByID(id)
}
func (f *fakeDrRepo) ListPlans(ctx context.Context, tenantID string, offset, limit int) ([]models.DRPlan, error) {
	if f.listPlansErr != nil {
		return nil, f.listPlansErr
	}
	var items []models.DRPlan
	for _, p := range f.plans {
		items = append(items, *p)
	}
	return items, nil
}
func (f *fakeDrRepo) UpdatePlan(ctx context.Context, tenantID, id string, req *models.UpdateDRPlanRequest) (*models.DRPlan, error) {
	if f.writeErr != nil {
		return nil, f.writeErr
	}
	p, ok := f.plans[id]
	if !ok {
		return nil, sql.ErrNoRows
	}
	if req.Name != nil {
		p.Name = *req.Name
	}
	if req.RTO != nil {
		p.RTO = *req.RTO
	}
	return p, nil
}
func (f *fakeDrRepo) UpdatePlanStatus(ctx context.Context, tenantID, id, status string) error {
	if f.bestEffortErr != nil {
		return f.bestEffortErr
	}
	if p, ok := f.plans[id]; ok {
		p.Status = status
	}
	return nil
}
func (f *fakeDrRepo) UpdatePlanLastTested(ctx context.Context, tenantID, id string, testedAt time.Time) error {
	if f.bestEffortErr != nil {
		return f.bestEffortErr
	}
	if p, ok := f.plans[id]; ok {
		p.LastTested = &testedAt
	}
	return nil
}
func (f *fakeDrRepo) DeletePlan(ctx context.Context, tenantID, id string) error {
	if f.writeErr != nil {
		return f.writeErr
	}
	delete(f.plans, id)
	f.deletedPlan = append(f.deletedPlan, id)
	return nil
}
func (f *fakeDrRepo) CountPlans(ctx context.Context, tenantID string) (int, error) {
	if f.countErr != nil {
		return 0, f.countErr
	}
	return len(f.plans), nil
}
func (f *fakeDrRepo) CreateFailoverTest(ctx context.Context, t *models.FailoverTest) error {
	if f.createTestErr != nil {
		return f.createTestErr
	}
	if f.writeErr != nil {
		return f.writeErr
	}
	f.tests[t.ID] = t
	return nil
}
func (f *fakeDrRepo) GetFailoverTestByID(ctx context.Context, tenantID, id string) (*models.FailoverTest, error) {
	if f.readErr != nil {
		return nil, f.readErr
	}
	t, ok := f.tests[id]
	if !ok {
		return nil, sql.ErrNoRows
	}
	return t, nil
}
func (f *fakeDrRepo) ListFailoverTests(ctx context.Context, tenantID string, planID *string) ([]models.FailoverTest, error) {
	if f.testsErr != nil {
		return nil, f.testsErr
	}
	var items []models.FailoverTest
	for _, t := range f.tests {
		if planID == nil || t.PlanID == *planID {
			items = append(items, *t)
		}
	}
	return items, nil
}
func (f *fakeDrRepo) CompleteFailoverTest(ctx context.Context, tenantID, id string, req *models.CompleteFailoverTestRequest) (*models.FailoverTest, error) {
	if f.writeErr != nil {
		return nil, f.writeErr
	}
	t, ok := f.tests[id]
	if !ok {
		return nil, sql.ErrNoRows
	}
	now := time.Now()
	t.CompletedAt = &now
	t.ActualRTO = &req.ActualRTO
	t.ActualRPO = &req.ActualRPO
	t.Result = req.Result
	t.Findings = req.Findings
	return t, nil
}
func (f *fakeDrRepo) CreateBackupConfig(ctx context.Context, b *models.BackupConfig) error {
	if f.writeErr != nil {
		return f.writeErr
	}
	f.backups[b.ID] = b
	return nil
}
func (f *fakeDrRepo) GetBackupConfigByID(ctx context.Context, tenantID, id string) (*models.BackupConfig, error) {
	if f.readErr != nil {
		return nil, f.readErr
	}
	b, ok := f.backups[id]
	if !ok {
		return nil, sql.ErrNoRows
	}
	return b, nil
}
func (f *fakeDrRepo) ListBackupConfigs(ctx context.Context, tenantID string, offset, limit int) ([]models.BackupConfig, error) {
	var items []models.BackupConfig
	for _, b := range f.backups {
		items = append(items, *b)
	}
	return items, nil
}
func (f *fakeDrRepo) UpdateBackupConfig(ctx context.Context, tenantID, id string, req *models.UpdateBackupConfigRequest) (*models.BackupConfig, error) {
	if f.writeErr != nil {
		return nil, f.writeErr
	}
	b, ok := f.backups[id]
	if !ok {
		return nil, sql.ErrNoRows
	}
	if req.RetentionDays != nil {
		b.RetentionDays = *req.RetentionDays
	}
	if req.Enabled != nil {
		b.Enabled = *req.Enabled
	}
	return b, nil
}
func (f *fakeDrRepo) DeleteBackupConfig(ctx context.Context, tenantID, id string) error {
	if f.writeErr != nil {
		return f.writeErr
	}
	delete(f.backups, id)
	return nil
}
func (f *fakeDrRepo) CountBackupConfigs(ctx context.Context, tenantID string) (int, error) {
	if f.countErr != nil {
		return 0, f.countErr
	}
	return len(f.backups), nil
}
func (f *fakeDrRepo) CreatePolicy(ctx context.Context, p *models.DRPolicy) error {
	if f.writeErr != nil {
		return f.writeErr
	}
	f.policies[p.ID] = p
	return nil
}
func (f *fakeDrRepo) GetPolicyByID(ctx context.Context, tenantID, id string) (*models.DRPolicy, error) {
	if f.readErr != nil {
		return nil, f.readErr
	}
	p, ok := f.policies[id]
	if !ok {
		return nil, sql.ErrNoRows
	}
	return p, nil
}
func (f *fakeDrRepo) ListPolicies(ctx context.Context, tenantID string, offset, limit int) ([]models.DRPolicy, error) {
	var items []models.DRPolicy
	for _, p := range f.policies {
		items = append(items, *p)
	}
	return items, nil
}
func (f *fakeDrRepo) CountPolicies(ctx context.Context, tenantID string) (int, error) {
	if f.countErr != nil {
		return 0, f.countErr
	}
	return len(f.policies), nil
}
func (f *fakeDrRepo) UpdatePolicy(ctx context.Context, tenantID, id string, req *models.UpdatePolicyRequest) (*models.DRPolicy, error) {
	if f.writeErr != nil {
		return nil, f.writeErr
	}
	p, ok := f.policies[id]
	if !ok {
		return nil, sql.ErrNoRows
	}
	if req.Strategy != nil {
		p.Strategy = *req.Strategy
	}
	return p, nil
}
func (f *fakeDrRepo) DeletePolicy(ctx context.Context, tenantID, id string) error {
	if f.writeErr != nil {
		return f.writeErr
	}
	delete(f.policies, id)
	return nil
}

var ctx0 = context.Background()

func mustPlan() *models.DRPlan {
	now := time.Now()
	return &models.DRPlan{
		ID: "plan-1", TenantID: "t1", Name: "api-dr", PlanType: "database",
		RPO: 60, RTO: 300, Status: "active", Priority: "high",
		FailoverStrategy: "manual", BackupRegions: models.StringArray{"us-east-2"},
		Services: models.JSONArray{map[string]interface{}{"name": "checkout"}},
		Config:   models.JSONB{}, CreatedBy: "u1", CreatedAt: now, UpdatedAt: now,
	}
}

func TestServiceRepositoryInterfaceSatisfied(t *testing.T) {
	// NewService taking the interface is what makes the fake injectable; if the
	// service ever reverts to the concrete repository this line stops compiling.
	svc := NewService(newFakeDrRepo())
	if svc.repo == nil {
		t.Fatal("NewService did not retain the repository")
	}
}

func TestServiceCreatePlanDefaultsAndFields(t *testing.T) {
	svc := NewService(newFakeDrRepo())
	got, err := svc.CreatePlan(ctx0, "t1", &models.CreateDRPlanRequest{Name: "n", RPO: 60, RTO: 300})
	if err != nil {
		t.Fatalf("CreatePlan returned %v", err)
	}
	if got == nil {
		t.Fatal("CreatePlan returned a nil plan without an error")
	}
	if got.Priority != "medium" {
		t.Errorf("default priority = %q, want medium", got.Priority)
	}
	if got.FailoverStrategy != "manual" {
		t.Errorf("default failover_strategy = %q, want manual", got.FailoverStrategy)
	}
	if got.CreatedBy != "system" {
		t.Errorf("default created_by = %q, want system", got.CreatedBy)
	}
	if got.Status != "active" {
		t.Errorf("status = %q, want active", got.Status)
	}
	if got.TenantID != "t1" {
		t.Errorf("tenant_id = %q, want t1: the caller supplied the tenant", got.TenantID)
	}
	if got.Config == nil {
		t.Error("config is nil, but the column is NOT NULL")
	}
	if len(got.BackupRegions) != 0 || len(got.Services) != 0 {
		t.Errorf("empty arrays must be non-nil slices: backup_regions=%v services=%v",
			got.BackupRegions, got.Services)
	}
}

func TestServiceCreatePlanRejectsInvalidInput(t *testing.T) {
	cases := []struct {
		name string
		req  *models.CreateDRPlanRequest
		frag string
	}{
		{"empty name", &models.CreateDRPlanRequest{RPO: 1, RTO: 1}, "plan name is required"},
		{"zero rto", &models.CreateDRPlanRequest{Name: "n", RPO: 1, RTO: 0}, "RTO target must be positive"},
		{"negative rto", &models.CreateDRPlanRequest{Name: "n", RPO: 1, RTO: -5}, "RTO target must be positive"},
		{"zero rpo", &models.CreateDRPlanRequest{Name: "n", RPO: 0, RTO: 1}, "RPO target must be positive"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			repo := newFakeDrRepo()
			svc := NewService(repo)
			plan, err := svc.CreatePlan(ctx0, "t1", tc.req)
			if err == nil {
				t.Fatalf("want ErrInvalidInput")
			}
			if plan != nil {
				t.Fatalf("plan = %+v, want nil with an error", plan)
			}
			if !errors.Is(err, ErrInvalidInput) {
				t.Fatalf("err = %v, want ErrInvalidInput so the handler answers 400", err)
			}
			if !strings.Contains(err.Error(), tc.frag) {
				t.Errorf("err = %q, want it to mention %q", err, tc.frag)
			}
			if len(repo.plans) != 0 {
				t.Errorf("a rejected request must not insert a row")
			}
		})
	}
}

func TestServiceCreatePlanInsertFailureIsFatal(t *testing.T) {
	repo := newFakeDrRepo()
	repo.writeErr = errors.New("relation dr_plans does not exist")
	svc := NewService(repo)
	plan, err := svc.CreatePlan(ctx0, "t1", &models.CreateDRPlanRequest{Name: "n", RPO: 1, RTO: 1})
	if err == nil {
		t.Fatal("want an error")
	}
	if plan != nil {
		t.Fatalf("plan = %+v, want nil", plan)
	}
	if errors.Is(err, ErrInvalidInput) {
		t.Fatalf("err = %v, an insert failure is not bad input", err)
	}
}

// TestServiceGetPlanSeparatesMissingFromBroken pins both branches of mapRead: a
// missing row keeps the ErrDRPlanNotFound sentinel so the handler can answer 404,
// while a storage failure must not be mislabelled as not-found.
func TestServiceGetPlanSeparatesMissingFromBroken(t *testing.T) {
	repo := newFakeDrRepo()
	svc := NewService(repo)

	plan, err := svc.GetPlan(ctx0, "t1", "nope")
	if err == nil || plan != nil {
		t.Fatalf("err=%v plan=%+v, want ErrDRPlanNotFound and nil", err, plan)
	}
	if !errors.Is(err, ErrDRPlanNotFound) {
		t.Fatalf("err = %v, want ErrDRPlanNotFound so the handler answers 404", err)
	}
	if !strings.Contains(err.Error(), "nope") {
		t.Errorf("err = %q, want the missing id in it", err)
	}

	refused := errors.New("connection refused")
	repo.readErr = refused
	plan, err = svc.GetPlan(ctx0, "t1", "plan-1")
	if err == nil || plan != nil {
		t.Fatalf("err=%v plan=%+v, want an error and nil", err, plan)
	}
	if errors.Is(err, ErrDRPlanNotFound) {
		t.Fatalf("err = %v, a refused connection is not a missing plan", err)
	}
	if !strings.Contains(err.Error(), "get plan") {
		t.Errorf("err = %q, want the operation label", err)
	}
	if !errors.Is(err, refused) {
		t.Errorf("err = %v, want the storage error to survive wrapping", err)
	}
}

func TestServiceUpdatePlan(t *testing.T) {
	repo := newFakeDrRepo()
	repo.plans["plan-1"] = mustPlan()
	svc := NewService(repo)

	name := "renamed"
	got, err := svc.UpdatePlan(ctx0, "t1", "plan-1", &models.UpdateDRPlanRequest{Name: &name})
	if err != nil || got == nil {
		t.Fatalf("err=%v got=%+v", err, got)
	}
	if got.Name != "renamed" {
		t.Errorf("name = %q, want renamed", got.Name)
	}

	repo.readErr = sql.ErrNoRows
	_, err = svc.UpdatePlan(ctx0, "t1", "gone", &models.UpdateDRPlanRequest{Name: &name})
	if err == nil {
		t.Fatal("want an error for a missing plan")
	}
	if !errors.Is(err, ErrDRPlanNotFound) {
		t.Fatalf("err = %v, want ErrDRPlanNotFound", err)
	}
}

func TestServiceDeletePlan(t *testing.T) {
	repo := newFakeDrRepo()
	repo.plans["plan-1"] = mustPlan()
	svc := NewService(repo)

	if err := svc.DeletePlan(ctx0, "t1", "plan-1"); err != nil {
		t.Fatalf("DeletePlan = %v", err)
	}
	if _, ok := repo.plans["plan-1"]; ok {
		t.Error("the plan is still in the store after DeletePlan")
	}
	if err := svc.DeletePlan(ctx0, "t1", "plan-1"); err == nil {
		t.Fatal("want an error when the plan is already gone")
	} else if !errors.Is(err, ErrDRPlanNotFound) {
		t.Fatalf("err = %v, want ErrDRPlanNotFound", err)
	}

	repo.plans["plan-1"] = mustPlan()
	repo.writeErr = errors.New("deadlock detected")
	if err := svc.DeletePlan(ctx0, "t1", "plan-1"); err == nil {
		t.Fatal("want an error when the DELETE fails")
	} else if errors.Is(err, ErrDRPlanNotFound) {
		t.Fatalf("err = %v, a failed DELETE must not read as already-deleted", err)
	}
}

func TestServiceTriggerFailover(t *testing.T) {
	repo := newFakeDrRepo()
	repo.plans["plan-1"] = mustPlan()
	svc := NewService(repo)

	res, err := svc.TriggerFailover(ctx0, "t1", "plan-1", "")
	if err != nil || res == nil {
		t.Fatalf("err=%v res=%+v", err, res)
	}
	if res.PlanID != "plan-1" || res.Status != "running" {
		t.Errorf("result = %+v, want plan-1/running", res)
	}
	if len(repo.tests) != 1 {
		t.Fatalf("failover tests = %d, want 1", len(repo.tests))
	}
	var got *models.FailoverTest
	for _, v := range repo.tests {
		got = v
	}
	if got.TestType != "real" || got.Result != "running" || got.CreatedBy != "system" {
		t.Errorf("test = %+v, want real/running/system", got)
	}
	if len(got.AffectedServices) != 1 || got.AffectedServices[0] != "checkout" {
		t.Errorf("affected_services = %v, want [checkout] from the plan services", got.AffectedServices)
	}
	if repo.plans["plan-1"].Status != "failing-over" {
		t.Errorf("plan status = %q, want failing-over", repo.plans["plan-1"].Status)
	}
}

func TestServiceTriggerFailoverMissingPlan(t *testing.T) {
	svc := NewService(newFakeDrRepo())
	res, err := svc.TriggerFailover(ctx0, "t1", "gone", "u1")
	if err == nil || res != nil {
		t.Fatalf("err=%v res=%+v, want ErrDRPlanNotFound and nil", err, res)
	}
	if !errors.Is(err, ErrDRPlanNotFound) {
		t.Fatalf("err = %v, want ErrDRPlanNotFound", err)
	}
}

func TestServiceTriggerFailoverInsertFailureIsFatal(t *testing.T) {
	repo := newFakeDrRepo()
	repo.plans["plan-1"] = mustPlan()
	repo.createTestErr = errors.New("relation dr_failover_tests does not exist")
	svc := NewService(repo)
	res, err := svc.TriggerFailover(ctx0, "t1", "plan-1", "u1")
	if err == nil || res != nil {
		t.Fatalf("err=%v res=%+v, want an error and nil", err, res)
	}
}

// TestServiceTestFailoverBestEffortUpdatesDoNotHideFailure makes the best-effort
// status and last_tested writes fail and checks the drill is still reported,
// because aborting here would duplicate the row on every retry.
func TestServiceTestFailoverBestEffortUpdatesDoNotHideFailure(t *testing.T) {
	repo := newFakeDrRepo()
	repo.plans["plan-1"] = mustPlan()
	repo.bestEffortErr = errors.New("disk full")
	svc := NewService(repo)
	res, err := svc.TestFailover(ctx0, "t1", "plan-1", "", "")
	if err != nil {
		t.Fatalf("TestFailover = %v: the drill was inserted before these writes", err)
	}
	if res == nil {
		t.Fatal("TestFailover returned a nil result")
	}
	if res.PlanID != "plan-1" || res.Status != "running" {
		t.Errorf("result = %+v, want plan-1/running", res)
	}
}

func TestServiceTestFailoverMissingPlan(t *testing.T) {
	svc := NewService(newFakeDrRepo())
	res, err := svc.TestFailover(ctx0, "t1", "gone", "n", "u1")
	if err == nil || res != nil {
		t.Fatalf("err=%v res=%+v, want ErrDRPlanNotFound and nil", err, res)
	}
	if !errors.Is(err, ErrDRPlanNotFound) {
		t.Fatalf("err = %v, want ErrDRPlanNotFound", err)
	}
}

func TestServiceCompleteFailoverTest(t *testing.T) {
	repo := newFakeDrRepo()
	repo.plans["plan-1"] = mustPlan()
	repo.tests["t-1"] = &models.FailoverTest{ID: "t-1", TenantID: "t1", PlanID: "plan-1", Result: "running"}
	svc := NewService(repo)

	got, err := svc.CompleteFailoverTest(ctx0, "t1", "t-1", &models.CompleteFailoverTestRequest{ActualRTO: 100, Result: "passed"})
	if err != nil || got == nil {
		t.Fatalf("err=%v got=%+v", err, got)
	}
	if got.CompletedAt == nil || *got.ActualRTO != 100 || got.Result != "passed" {
		t.Errorf("test = %+v, want completed_at set, actual_rto 100, passed", got)
	}
	if repo.plans["plan-1"].LastTested == nil {
		t.Error("last_tested was not recorded on the plan after completing a test")
	}

	repo.writeErr = errors.New("disk full")
	got, err = svc.CompleteFailoverTest(ctx0, "t1", "t-1", &models.CompleteFailoverTestRequest{Result: "passed"})
	if err == nil {
		t.Fatal("want an error when the completion write fails")
	}
	if got != nil {
		t.Fatalf("got = %+v, want nil with an error", got)
	}
}

func TestServiceCompleteFailoverTestMissing(t *testing.T) {
	svc := NewService(newFakeDrRepo())
	got, err := svc.CompleteFailoverTest(ctx0, "t1", "gone", &models.CompleteFailoverTestRequest{Result: "passed"})
	if err == nil || got != nil {
		t.Fatalf("err=%v got=%+v, want ErrFailoverTestNotFound and nil", err, got)
	}
	if !errors.Is(err, ErrFailoverTestNotFound) {
		t.Fatalf("err = %v, want ErrFailoverTestNotFound", err)
	}
}

func TestServiceGetFailoverTestSeparatesMissingFromBroken(t *testing.T) {
	repo := newFakeDrRepo()
	svc := NewService(repo)
	got, err := svc.GetFailoverTest(ctx0, "t1", "gone")
	if err == nil || got != nil {
		t.Fatalf("err=%v got=%+v, want ErrFailoverTestNotFound and nil", err, got)
	}
	if !errors.Is(err, ErrFailoverTestNotFound) {
		t.Fatalf("err = %v, want ErrFailoverTestNotFound", err)
	}
	repo.readErr = errors.New("timeout")
	got, err = svc.GetFailoverTest(ctx0, "t1", "gone")
	if err == nil || got != nil {
		t.Fatalf("err=%v got=%+v, want an error and nil", err, got)
	}
	if errors.Is(err, ErrFailoverTestNotFound) {
		t.Fatalf("err = %v, a timeout is not a missing row", err)
	}
}

func TestServiceCreateBackupConfigDefaults(t *testing.T) {
	repo := newFakeDrRepo()
	svc := NewService(repo)
	got, err := svc.CreateBackupConfig(ctx0, "t1", &models.CreateBackupConfigRequest{
		SourceType: "db", SourceID: "pg-1", StorageLocation: "s3://x",
	})
	if err != nil || got == nil {
		t.Fatalf("err=%v got=%+v", err, got)
	}
	if got.BackupSchedule != "0 2 * * *" {
		t.Errorf("default schedule = %q, want 0 2 * * *", got.BackupSchedule)
	}
	if got.RetentionDays != 30 {
		t.Errorf("default retention = %d, want 30", got.RetentionDays)
	}
	if got.Compression != "gzip" {
		t.Errorf("default compression = %q, want gzip", got.Compression)
	}
	if !got.Encryption || !got.Enabled {
		t.Errorf("encryption=%v enabled=%v, want both true", got.Encryption, got.Enabled)
	}
	if got.CreatedBy != "system" {
		t.Errorf("created_by = %q, want system", got.CreatedBy)
	}
}

func TestServiceCreateBackupConfigRejectsMissingSource(t *testing.T) {
	svc := NewService(newFakeDrRepo())
	for _, req := range []*models.CreateBackupConfigRequest{
		{SourceID: "pg-1", StorageLocation: "s3://x"},
		{SourceType: "db", StorageLocation: "s3://x"},
	} {
		got, err := svc.CreateBackupConfig(ctx0, "t1", req)
		if err == nil {
			t.Fatalf("want ErrInvalidInput for %+v", req)
		}
		if got != nil {
			t.Fatalf("got = %+v, want nil with an error", got)
		}
		if !errors.Is(err, ErrInvalidInput) {
			t.Fatalf("err = %v, want ErrInvalidInput so the handler answers 400", err)
		}
	}
}

func TestServiceBackupConfigCrudErrors(t *testing.T) {
	repo := newFakeDrRepo()
	svc := NewService(repo)

	got, err := svc.GetBackupConfig(ctx0, "t1", "gone")
	if err == nil || got != nil {
		t.Fatalf("err=%v got=%+v, want ErrBackupConfigNotFound and nil", err, got)
	}
	if !errors.Is(err, ErrBackupConfigNotFound) {
		t.Fatalf("err = %v, want ErrBackupConfigNotFound", err)
	}
	repo.readErr = errors.New("deadlock")
	got, err = svc.GetBackupConfig(ctx0, "t1", "gone")
	if err == nil || got != nil {
		t.Fatalf("err=%v got=%+v, want an error and nil", err, got)
	}
	if errors.Is(err, ErrBackupConfigNotFound) {
		t.Fatalf("err = %v, a deadlock is not a missing row", err)
	}
	repo.readErr = nil

	if err := svc.DeleteBackupConfig(ctx0, "t1", "gone"); err == nil {
		t.Fatal("want an error when the backup config is missing")
	} else if !errors.Is(err, ErrBackupConfigNotFound) {
		t.Fatalf("err = %v, want ErrBackupConfigNotFound", err)
	}
}

func TestServiceCreatePolicyValidation(t *testing.T) {
	repo := newFakeDrRepo()
	svc := NewService(repo)
	got, err := svc.CreatePolicy(ctx0, "t1", &models.CreatePolicyRequest{
		Name: "n", Services: []interface{}{"a"}, Strategy: "warm-standby", RPO: "30m", RTO: "1h",
	})
	if err != nil || got == nil {
		t.Fatalf("err=%v got=%+v", err, got)
	}
	if got.Status != "active" || got.CreatedBy != "system" || got.Config == nil {
		t.Errorf("policy = %+v, want active/system/non-nil config", got)
	}
	if len(repo.policies) != 1 {
		t.Fatalf("policies = %d, want 1", len(repo.policies))
	}

	_, err = svc.CreatePolicy(ctx0, "t1", &models.CreatePolicyRequest{Services: []interface{}{"a"}})
	if err == nil {
		t.Fatal("want an error for a missing name")
	}
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("err = %v, want ErrInvalidInput", err)
	}
}

func TestServicePolicyErrors(t *testing.T) {
	repo := newFakeDrRepo()
	svc := NewService(repo)

	pol, err := svc.GetPolicy(ctx0, "t1", "gone")
	if err == nil || pol != nil {
		t.Fatalf("err=%v pol=%+v, want ErrPolicyNotFound and nil", err, pol)
	}
	if !errors.Is(err, ErrPolicyNotFound) {
		t.Fatalf("err = %v, want ErrPolicyNotFound", err)
	}
	repo.readErr = errors.New("deadlock")
	pol, err = svc.GetPolicy(ctx0, "t1", "gone")
	if err == nil || pol != nil {
		t.Fatalf("err=%v pol=%+v, want an error and nil", err, pol)
	}
	if errors.Is(err, ErrPolicyNotFound) {
		t.Fatalf("err = %v, a deadlock is not a missing row", err)
	}
	repo.readErr = nil

	if err := svc.DeletePolicy(ctx0, "t1", "gone"); err == nil {
		t.Fatal("want an error when the policy is missing")
	} else if !errors.Is(err, ErrPolicyNotFound) {
		t.Fatalf("err = %v, want ErrPolicyNotFound", err)
	}
}

// TestServiceRTOStatusReadFailureIsFatal pins the two call sites that used to
// swallow ListFailoverTests and keep going: a failure mid-scan answered with a
// partial compliance list, which read as compliant plans that were never checked.
func TestServiceRTOStatusReadFailureIsFatal(t *testing.T) {
	repo := newFakeDrRepo()
	repo.plans["plan-1"] = mustPlan()
	repo.testsErr = errors.New("relation dr_failover_tests does not exist")
	svc := NewService(repo)
	got, err := svc.GetRTOStatus(ctx0, "t1")
	if err == nil {
		t.Fatal("want an error when the failover test read fails")
	}
	if got != nil {
		t.Fatalf("got = %+v, want nil: a partial list must not be reported as status", got)
	}
	if !strings.Contains(err.Error(), "plan-1") {
		t.Errorf("err = %q, want the failing plan id", err)
	}

	repo.testsErr = nil
	repo.listPlansErr = errors.New("relation dr_plans does not exist")
	got, err = svc.GetRTOStatus(ctx0, "t1")
	if err == nil || got != nil {
		t.Fatalf("err=%v got=%+v, want an error and nil", err, got)
	}
}

func TestServiceRTOStatusCompliance(t *testing.T) {
	repo := newFakeDrRepo()
	repo.plans["plan-1"] = mustPlan() // RTO 300, RPO 60
	done := time.Now()
	repo.tests["t-1"] = &models.FailoverTest{ID: "t-1", PlanID: "plan-1", CompletedAt: &done, ActualRTO: intPtr(120), ActualRPO: intPtr(30), Result: "passed"}
	svc := NewService(repo)

	rto, err := svc.GetRTOStatus(ctx0, "t1")
	if err != nil {
		t.Fatalf("GetRTOStatus = %v", err)
	}
	if len(rto) != 1 {
		t.Fatalf("rto = %+v, want 1 entry", rto)
	}
	if rto[0].Compliance != "compliant" {
		t.Errorf("rto compliance = %q, want compliant (120 <= 300)", rto[0].Compliance)
	}
	if rto[0].LastTested == nil || *rto[0].LastTestRTO != 120 {
		t.Errorf("rto = %+v, want last_test_rto 120 and last_tested set", rto[0])
	}

	rpo, err := svc.GetRPOStatus(ctx0, "t1")
	if err != nil {
		t.Fatalf("GetRPOStatus = %v", err)
	}
	if len(rpo) != 1 || rpo[0].Compliance != "compliant" {
		t.Errorf("rpo = %+v, want compliant (30 <= 60)", rpo)
	}
	if rpo[0].LastTestRPO == nil || *rpo[0].LastTestRPO != 30 {
		t.Errorf("rpo = %+v, want last_test_rpo 30", rpo[0])
	}
}

func TestServiceRTOStatusNotTestedAndNonCompliant(t *testing.T) {
	repo := newFakeDrRepo()
	repo.plans["plan-1"] = mustPlan() // RTO 300
	svc := NewService(repo)

	rto, err := svc.GetRTOStatus(ctx0, "t1")
	if err != nil {
		t.Fatalf("GetRTOStatus = %v", err)
	}
	if len(rto) != 1 || rto[0].Compliance != "not-tested" {
		t.Errorf("rto = %+v, want not-tested for a plan with no tests", rto)
	}

	done := time.Now()
	repo.tests["t-1"] = &models.FailoverTest{ID: "t-1", PlanID: "plan-1", CompletedAt: &done, ActualRTO: intPtr(900), Result: "passed"}
	rto, err = svc.GetRTOStatus(ctx0, "t1")
	if err != nil {
		t.Fatalf("GetRTOStatus = %v", err)
	}
	if rto[0].Compliance != "non-compliant" {
		t.Errorf("compliance = %q, want non-compliant (900 > 300)", rto[0].Compliance)
	}

	// An incomplete test has no completed_at, so it must not count as a test at
	// all; only the second row is eligible.
	running := &models.FailoverTest{ID: "t-2", PlanID: "plan-1", Result: "running"}
	repo.tests["t-2"] = running
	rto, err = svc.GetRTOStatus(ctx0, "t1")
	if err != nil {
		t.Fatalf("GetRTOStatus = %v", err)
	}
	if rto[0].LastTested == nil {
		t.Error("a completed test was shadowed by an incomplete one")
	}
}

func TestServiceScheduleDrillStoresSchedule(t *testing.T) {
	repo := newFakeDrRepo()
	repo.plans["plan-1"] = mustPlan()
	svc := NewService(repo)
	planID := "plan-1"
	when := "2030-01-01T02:00:00Z"

	got, err := svc.ScheduleDrill(ctx0, "t1", &models.ScheduleDrillRequest{
		PlanID: &planID, ComponentType: "checkout", ScheduledAt: when,
	})
	if err != nil || got == nil {
		t.Fatalf("err=%v got=%+v", err, got)
	}
	if got.ScheduledAt == nil {
		t.Fatal("scheduled_at was dropped: the request accepted it and the insert lost it")
	}
	if got.ScheduledAt.Format(time.RFC3339) != when {
		t.Errorf("scheduled_at = %s, want %s", got.ScheduledAt.Format(time.RFC3339), when)
	}
	if got.Result != "scheduled" || got.TestType != "scheduled-drill" {
		t.Errorf("test = %+v, want scheduled/scheduled-drill", got)
	}
	if got.PlanID != "plan-1" {
		t.Errorf("plan_id = %q, want plan-1", got.PlanID)
	}
}

func TestServiceScheduleDrillRejectsBadTimestamp(t *testing.T) {
	repo := newFakeDrRepo()
	repo.plans["plan-1"] = mustPlan()
	svc := NewService(repo)
	planID := "plan-1"
	got, err := svc.ScheduleDrill(ctx0, "t1", &models.ScheduleDrillRequest{
		PlanID: &planID, ComponentType: "checkout", ScheduledAt: "next tuesday",
	})
	if err == nil {
		t.Fatal("want an error for an unparseable scheduled_at")
	}
	if got != nil {
		t.Fatalf("got = %+v, want nil with an error", got)
	}
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("err = %v, want ErrInvalidInput so the handler answers 400", err)
	}
	if !strings.Contains(err.Error(), "scheduled_at") {
		t.Errorf("err = %q, want the field name", err)
	}
	if len(repo.tests) != 0 {
		t.Error("a rejected drill must not insert a row")
	}
}

func TestServiceScheduleDrillMatchesPlanByComponent(t *testing.T) {
	repo := newFakeDrRepo()
	repo.plans["plan-1"] = mustPlan() // services [{"name":"checkout"}]
	svc := NewService(repo)

	got, err := svc.ScheduleDrill(ctx0, "t1", &models.ScheduleDrillRequest{ComponentType: "checkout"})
	if err != nil || got == nil {
		t.Fatalf("err=%v got=%+v", err, got)
	}
	if got.PlanID != "plan-1" {
		t.Errorf("plan_id = %q, want plan-1 matched by component", got.PlanID)
	}
	if got.ScheduledAt != nil {
		t.Errorf("scheduled_at = %v, want nil when none was requested", got.ScheduledAt)
	}

	_, err = svc.ScheduleDrill(ctx0, "t1", &models.ScheduleDrillRequest{ComponentType: "nothing"})
	if err == nil {
		t.Fatal("want an error when no plan matches the component")
	}
	if !errors.Is(err, ErrDRPlanNotFound) {
		t.Fatalf("err = %v, want ErrDRPlanNotFound", err)
	}
}

func TestServiceScheduleDrillMissingPlan(t *testing.T) {
	svc := NewService(newFakeDrRepo())
	planID := "gone"
	got, err := svc.ScheduleDrill(ctx0, "t1", &models.ScheduleDrillRequest{
		PlanID: &planID, ComponentType: "checkout",
	})
	if err == nil || got != nil {
		t.Fatalf("err=%v got=%+v, want ErrDRPlanNotFound and nil", err, got)
	}
	if !errors.Is(err, ErrDRPlanNotFound) {
		t.Fatalf("err = %v, want ErrDRPlanNotFound", err)
	}
}

func TestServiceScheduleDrillInsertFailureIsFatal(t *testing.T) {
	repo := newFakeDrRepo()
	repo.plans["plan-1"] = mustPlan()
	repo.createTestErr = errors.New("relation dr_failover_tests does not exist")
	svc := NewService(repo)
	planID := "plan-1"
	got, err := svc.ScheduleDrill(ctx0, "t1", &models.ScheduleDrillRequest{
		PlanID: &planID, ComponentType: "checkout",
	})
	if err == nil || got != nil {
		t.Fatalf("err=%v got=%+v, want an error and nil", err, got)
	}
}

func TestServiceListDrillsPassesNoPlanFilter(t *testing.T) {
	repo := newFakeDrRepo()
	repo.tests["t-1"] = &models.FailoverTest{ID: "t-1", PlanID: "plan-1"}
	svc := NewService(repo)
	got, err := svc.ListDrills(ctx0, "t1")
	if err != nil {
		t.Fatalf("ListDrills = %v", err)
	}
	if len(got) != 1 || got[0].ID != "t-1" {
		t.Errorf("drills = %+v, want the unfiltered test list", got)
	}
}

func TestServiceCanFailover(t *testing.T) {
	svc := NewService(newFakeDrRepo())

	if !svc.CanFailover(&models.DRPolicy{Strategy: "active-active"}, "anywhere") {
		t.Error("active-active must allow any region")
	}
	if svc.CanFailover(&models.DRPolicy{
		Strategy: "warm-standby",
		Config:   models.JSONB{"allowed_regions": []interface{}{"us-east-2"}},
	}, "eu-west-1") {
		t.Error("a region outside allowed_regions must be blocked")
	}
	if !svc.CanFailover(&models.DRPolicy{
		Strategy: "warm-standby",
		Config:   models.JSONB{"allowed_regions": []interface{}{"us-east-2"}},
	}, "us-east-2") {
		t.Error("an allowed region must be permitted")
	}
	if svc.CanFailover(&models.DRPolicy{Strategy: "active-passive"}, "us-east-2") {
		t.Error("active-passive must be blocked by default")
	}
	if !svc.CanFailover(&models.DRPolicy{Strategy: "cold-standby"}, "us-east-2") {
		t.Error("cold-standby must be permitted by default")
	}
}

func TestServiceCheckCompliance(t *testing.T) {
	svc := NewService(newFakeDrRepo())
	for _, tc := range []struct {
		rto, rpo string
		actual   int
		want     bool
	}{
		{"5m", "30s", 300, true},
		{"5m", "30s", 301, false},
		{"1h", "30s", 3600, true},
		{"30s", "30s", 60, false},
	} {
		got := svc.CheckCompliance(&models.DRPolicy{RTO: tc.rto, RPO: tc.rpo}, tc.actual, 5)
		if got != tc.want {
			t.Errorf("CheckCompliance(rto=%s, actual=%d) = %v, want %v", tc.rto, tc.actual, got, tc.want)
		}
	}
	if svc.CheckCompliance(&models.DRPolicy{RTO: "5m", RPO: "30s"}, 5, 31) {
		t.Error("an RPO breach must fail compliance")
	}
}

func TestServiceParseDuration(t *testing.T) {
	for _, tc := range []struct {
		in   string
		want int
	}{
		{"30s", 30},
		{"5m", 300},
		{"1h", 3600},
		{"12", 12},
		{"", 0},
		{"never", 0},
	} {
		if got := parseDuration(tc.in); got != tc.want {
			t.Errorf("parseDuration(%q) = %d, want %d", tc.in, got, tc.want)
		}
	}
}

func TestServiceCostEstimate(t *testing.T) {
	svc := NewService(newFakeDrRepo())
	for _, tc := range []struct {
		strategy string
		count    int
		wantCost int
	}{
		{"active-active", 3, 30},
		{"active-passive", 2, 120},
		{"warm-standby", 4, 540},
		{"cold-standby", 1, 1010},
		{"unknown", 2, 20},
	} {
		got := svc.GetFailoverCostEstimate(tc.strategy, tc.count)
		if got.Strategy != tc.strategy || got.ServiceCount != tc.count {
			t.Errorf("estimate = %+v, want strategy %q count %d", got, tc.strategy, tc.count)
		}
		if got.CostEstimate != tc.wantCost {
			t.Errorf("cost(strategy=%s, count=%d) = %d, want %d", tc.strategy, tc.count, got.CostEstimate, tc.wantCost)
		}
	}
}

func TestServiceExtractServiceNames(t *testing.T) {
	names := extractServiceNames(models.JSONArray{
		"plain",
		map[string]interface{}{"name": "mapped"},
		map[string]interface{}{"id": 1},
		42,
	})
	want := models.StringArray{"plain", "mapped", "unknown", "unknown"}
	if len(names) != len(want) {
		t.Fatalf("names = %v, want %v", names, want)
	}
	for i := range want {
		if names[i] != want[i] {
			t.Errorf("names[%d] = %q, want %q", i, names[i], want[i])
		}
	}
}

func intPtr(v int) *int {
	return &v
}
