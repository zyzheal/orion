package service

import (
	"context"
	"testing"
	"time"

	"orion/platform-svc-go/internal/tenant-quota/models"
)

type fakeTQRepo struct {
	plans  map[string]*models.QuotaPlan
	usages map[string]*models.QuotaUsage
	alerts []models.QuotaAlert
}

func newFakeTQRepo() *fakeTQRepo {
	return &fakeTQRepo{
		plans:  make(map[string]*models.QuotaPlan),
		usages: make(map[string]*models.QuotaUsage),
	}
}

func (f *fakeTQRepo) CreatePlan(ctx context.Context, p *models.QuotaPlan) error {
	f.plans[p.ID] = p
	return nil
}

func (f *fakeTQRepo) GetPlan(ctx context.Context, id, tenantID string) (*models.QuotaPlan, error) {
	p, ok := f.plans[id]
	if !ok {
		return nil, nil
	}
	return p, nil
}

func (f *fakeTQRepo) ListPlans(ctx context.Context, tenantID string) ([]models.QuotaPlan, error) {
	var items []models.QuotaPlan
	for _, p := range f.plans {
		if p.TenantID == tenantID {
			items = append(items, *p)
		}
	}
	return items, nil
}

func (f *fakeTQRepo) UpdatePlan(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.QuotaPlan, error) {
	p, ok := f.plans[id]
	if !ok {
		return nil, nil
	}
	if v, ok := attrs["name"]; ok {
		p.Name = v.(string)
	}
	return p, nil
}

func (f *fakeTQRepo) DeletePlan(ctx context.Context, id, tenantID string) (bool, error) {
	if _, ok := f.plans[id]; !ok {
		return false, nil
	}
	delete(f.plans, id)
	return true, nil
}

func (f *fakeTQRepo) GetUsage(ctx context.Context, tenantID, metric string) (*models.QuotaUsage, error) {
	key := tenantID + "/" + metric
	u, ok := f.usages[key]
	if !ok {
		return nil, nil
	}
	return u, nil
}

func (f *fakeTQRepo) IncrementUsage(ctx context.Context, tenantID, metric string, amount int64, resetAt time.Time) (*models.QuotaUsage, error) {
	key := tenantID + "/" + metric
	u, ok := f.usages[key]
	if !ok {
		u = &models.QuotaUsage{
			TenantID:     tenantID,
			Metric:       metric,
			CurrentValue: 0,
			ResetAt:      resetAt,
		}
		f.usages[key] = u
	}
	u.CurrentValue += amount
	return u, nil
}

func (f *fakeTQRepo) ListUsage(ctx context.Context, tenantID string) ([]models.QuotaUsage, error) {
	var items []models.QuotaUsage
	for _, u := range f.usages {
		if u.TenantID == tenantID {
			items = append(items, *u)
		}
	}
	return items, nil
}

func (f *fakeTQRepo) ResetUsage(ctx context.Context, tenantID string) error {
	return nil
}

func (f *fakeTQRepo) CreateAlert(ctx context.Context, a *models.QuotaAlert) error {
	f.alerts = append(f.alerts, *a)
	return nil
}

func (f *fakeTQRepo) ListAlerts(ctx context.Context, tenantID string) ([]models.QuotaAlert, error) {
	return f.alerts, nil
}

func TestTQ_CreatePlan_appliesDefaults(t *testing.T) {
	repo := newFakeTQRepo()
	svc := NewService(repo)

	p, err := svc.CreatePlan(context.Background(), &models.CreatePlanRequest{Name: "free"}, "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if p.Name != "free" {
		t.Errorf("Name = %q", p.Name)
	}
	if p.APIRateLimitPerMin != 1000 {
		t.Errorf("APIRateLimitPerMin = %d, want 1000 (default)", p.APIRateLimitPerMin)
	}
	if p.MaxUsers != 500 {
		t.Errorf("MaxUsers = %d, want 500", p.MaxUsers)
	}
	if p.SLATier != "standard" {
		t.Errorf("SLATier = %q, want standard", p.SLATier)
	}
}

func TestTQ_CreatePlan_withCustomValues(t *testing.T) {
	repo := newFakeTQRepo()
	svc := NewService(repo)

	p, err := svc.CreatePlan(context.Background(), &models.CreatePlanRequest{
		Name:     "pro",
		MaxUsers: 100,
		SLATier:  "premium",
	}, "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if p.MaxUsers != 100 {
		t.Errorf("MaxUsers = %d, want 100", p.MaxUsers)
	}
	if p.SLATier != "premium" {
		t.Errorf("SLATier = %q, want premium", p.SLATier)
	}
}

func TestTQ_IncrementUsage_statusThresholds(t *testing.T) {
	repo := newFakeTQRepo()
	svc := NewService(repo)

	svc.CreatePlan(context.Background(), &models.CreatePlanRequest{
		Name:               "test",
		APIRateLimitPerMin: 100,
	}, "t1")

	result, err := svc.IncrementUsage(context.Background(), &models.IncrementUsageRequest{
		Metric: "api_rate_per_min",
		Amount: 50,
		Window: "1m",
	}, "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if result.Status != "normal" {
		t.Errorf("50%% status = %q, want normal", result.Status)
	}

	result, err = svc.IncrementUsage(context.Background(), &models.IncrementUsageRequest{
		Metric: "api_rate_per_min",
		Amount: 30,
		Window: "1m",
	}, "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if result.Status != "warning" {
		t.Errorf("80%% status = %q, want warning", result.Status)
	}
	if len(repo.alerts) != 1 {
		t.Errorf("alerts = %d, want 1 at 80%%", len(repo.alerts))
	}
	if repo.alerts[0].AlertLevel != "warning" {
		t.Errorf("alert level = %q, want warning", repo.alerts[0].AlertLevel)
	}
}

func TestTQ_CheckQuota_allowsWithinLimit(t *testing.T) {
	repo := newFakeTQRepo()
	svc := NewService(repo)

	svc.CreatePlan(context.Background(), &models.CreatePlanRequest{
		Name:               "test",
		APIRateLimitPerMin: 100,
	}, "t1")

	result, err := svc.CheckQuota(context.Background(), "t1", "api_rate_per_min", 50)
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if !result.Allowed {
		t.Error("50 within limit 100 should be allowed")
	}
	if result.Remaining != 100 {
		t.Errorf("Remaining = %d, want 100", result.Remaining)
	}
}

func TestTQ_CheckQuota_exceedsLimit(t *testing.T) {
	repo := newFakeTQRepo()
	svc := NewService(repo)

	svc.CreatePlan(context.Background(), &models.CreatePlanRequest{
		Name:               "test",
		APIRateLimitPerMin: 100,
	}, "t1")

	repo.usages["t1/api_rate_per_min"] = &models.QuotaUsage{
		TenantID:     "t1",
		Metric:       "api_rate_per_min",
		CurrentValue: 90,
	}

	result, err := svc.CheckQuota(context.Background(), "t1", "api_rate_per_min", 20)
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if result.Allowed {
		t.Error("110 > 100 should not be allowed")
	}
	if !result.Exceeded {
		t.Error("Exceeded should be true")
	}
}

func TestTQ_CreatePlan_appliesPolicyDefaults(t *testing.T) {
	repo := newFakeTQRepo()
	svc := NewService(repo)

	p, err := svc.CreatePlan(context.Background(), &models.CreatePlanRequest{
		Name: "free",
	}, "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if p.OverLimitAction != "block" {
		t.Errorf("OverLimitAction = %q, want block", p.OverLimitAction)
	}
	if len(p.WarnThresholds) != 3 || p.WarnThresholds[0] != 50 || p.WarnThresholds[1] != 80 || p.WarnThresholds[2] != 95 {
		t.Errorf("WarnThresholds = %v, want [50 80 95]", p.WarnThresholds)
	}
}

func TestTQ_CreatePlan_normalizesOverLimitAction(t *testing.T) {
	repo := newFakeTQRepo()
	svc := NewService(repo)

	p, err := svc.CreatePlan(context.Background(), &models.CreatePlanRequest{
		Name:            "free",
		OverLimitAction: "ALLOW",
	}, "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if p.OverLimitAction != "allow" {
		t.Errorf("OverLimitAction = %q, want allow", p.OverLimitAction)
	}
}

func TestTQ_CreatePlan_normalizesWarnThresholds(t *testing.T) {
	repo := newFakeTQRepo()
	svc := NewService(repo)

	p, err := svc.CreatePlan(context.Background(), &models.CreatePlanRequest{
		Name:           "free",
		WarnThresholds: []int{95, 50, 80, 50, -10, 150},
	}, "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	want := []int{0, 50, 80, 95, 100}
	if len(p.WarnThresholds) != len(want) {
		t.Fatalf("WarnThresholds = %v, want %v", p.WarnThresholds, want)
	}
	for i, v := range want {
		if p.WarnThresholds[i] != v {
			t.Errorf("WarnThresholds[%d] = %d, want %d", i, p.WarnThresholds[i], v)
		}
	}
}

func TestTQ_CheckWithPolicy_UnderSoft(t *testing.T) {
	repo := newFakeTQRepo()
	svc := NewService(repo)

	svc.CreatePlan(context.Background(), &models.CreatePlanRequest{
		Name:          "test",
		MaxUsers:      100,
		SoftLimit:     80,
		HardLimit:     100,
		OverLimitAction: "block",
	}, "t1")
	repo.usages["t1/users"] = &models.QuotaUsage{TenantID: "t1", Metric: "users", CurrentValue: 10}

	r, err := svc.CheckQuotaWithPolicy(context.Background(), "t1", &models.CheckWithPolicyRequest{
		Metric: "users", Amount: 5,
	})
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if !r.Allowed || r.Blocking {
		t.Errorf("15 < soft 80 should be allowed non-blocking; got allowed=%v blocking=%v", r.Allowed, r.Blocking)
	}
	if len(r.Warning) != 0 {
		t.Errorf("Warning = %v, want empty", r.Warning)
	}
	if r.SoftLimit != 80 || r.HardLimit != 100 {
		t.Errorf("limits = %d/%d, want 80/100", r.SoftLimit, r.HardLimit)
	}
}

func TestTQ_CheckWithPolicy_BetweenSoftAndHard(t *testing.T) {
	repo := newFakeTQRepo()
	svc := NewService(repo)

	svc.CreatePlan(context.Background(), &models.CreatePlanRequest{
		Name:          "test",
		MaxUsers:      100,
		SoftLimit:     80,
		HardLimit:     100,
		OverLimitAction: "block",
	}, "t1")
	repo.usages["t1/users"] = &models.QuotaUsage{TenantID: "t1", Metric: "users", CurrentValue: 85}

	r, err := svc.CheckQuotaWithPolicy(context.Background(), "t1", &models.CheckWithPolicyRequest{
		Metric: "users", Amount: 5,
	})
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if !r.Allowed || r.Blocking {
		t.Errorf("90 >= soft but < hard should be allowed non-blocking")
	}
	if len(r.Warning) != 1 {
		t.Fatalf("Warning = %v, want 1 entry", r.Warning)
	}
}

func TestTQ_CheckWithPolicy_OverHard_Block(t *testing.T) {
	repo := newFakeTQRepo()
	svc := NewService(repo)

	svc.CreatePlan(context.Background(), &models.CreatePlanRequest{
		Name:          "test",
		MaxUsers:      100,
		SoftLimit:     80,
		HardLimit:     100,
		OverLimitAction: "block",
	}, "t1")
	repo.usages["t1/users"] = &models.QuotaUsage{TenantID: "t1", Metric: "users", CurrentValue: 90}

	r, err := svc.CheckQuotaWithPolicy(context.Background(), "t1", &models.CheckWithPolicyRequest{
		Metric: "users", Amount: 20,
	})
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if r.Allowed || !r.Blocking {
		t.Errorf("110 >= hard 100 with action=block should be blocked; got allowed=%v blocking=%v", r.Allowed, r.Blocking)
	}
}

func TestTQ_CheckWithPolicy_OverHard_Warn(t *testing.T) {
	repo := newFakeTQRepo()
	svc := NewService(repo)

	svc.CreatePlan(context.Background(), &models.CreatePlanRequest{
		Name:          "test",
		MaxUsers:      100,
		SoftLimit:     80,
		HardLimit:     100,
		OverLimitAction: "warn",
	}, "t1")
	repo.usages["t1/users"] = &models.QuotaUsage{TenantID: "t1", Metric: "users", CurrentValue: 95}

	r, err := svc.CheckQuotaWithPolicy(context.Background(), "t1", &models.CheckWithPolicyRequest{
		Metric: "users", Amount: 20,
	})
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if !r.Allowed || r.Blocking {
		t.Errorf("action=warn should allow non-blocking")
	}
	if len(r.Warning) == 0 {
		t.Error("action=warn should include warning")
	}
}

func TestTQ_CheckWithPolicy_OverHard_Allow(t *testing.T) {
	repo := newFakeTQRepo()
	svc := NewService(repo)

	svc.CreatePlan(context.Background(), &models.CreatePlanRequest{
		Name:          "test",
		MaxUsers:      100,
		SoftLimit:     80,
		HardLimit:     100,
		OverLimitAction: "allow",
	}, "t1")
	repo.usages["t1/users"] = &models.QuotaUsage{TenantID: "t1", Metric: "users", CurrentValue: 95}

	r, err := svc.CheckQuotaWithPolicy(context.Background(), "t1", &models.CheckWithPolicyRequest{
		Metric: "users", Amount: 20,
	})
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if !r.Allowed || r.Blocking {
		t.Errorf("action=allow should allow non-blocking")
	}
	if len(r.Warning) != 0 {
		t.Errorf("action=allow should not emit warnings; got %v", r.Warning)
	}
}

func TestTQ_CheckWithPolicy_DefaultSoftAt80PctOfHard(t *testing.T) {
	repo := newFakeTQRepo()
	svc := NewService(repo)

	// No SoftLimit set — should default to hard*0.8.
	svc.CreatePlan(context.Background(), &models.CreatePlanRequest{
		Name:          "test",
		MaxUsers:      100,
		OverLimitAction: "block",
	}, "t1")
	repo.usages["t1/users"] = &models.QuotaUsage{TenantID: "t1", Metric: "users", CurrentValue: 10}

	r, err := svc.CheckQuotaWithPolicy(context.Background(), "t1", &models.CheckWithPolicyRequest{
		Metric: "users", Amount: 5,
	})
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	// HardLimit = MaxUsers = 100, SoftLimit default = 100*4/5 = 80.
	if r.HardLimit != 100 {
		t.Errorf("HardLimit = %d, want 100", r.HardLimit)
	}
	if r.SoftLimit != 80 {
		t.Errorf("SoftLimit = %d, want 80 (80%% of hard)", r.SoftLimit)
	}
}

func TestTQ_CheckWithPolicy_PlanHardOverrideWinsOverMetricLimit(t *testing.T) {
	repo := newFakeTQRepo()
	svc := NewService(repo)

	// Plan hard limit 50 is lower than MaxUsers=100; 50 should win.
	svc.CreatePlan(context.Background(), &models.CreatePlanRequest{
		Name:          "test",
		MaxUsers:      100,
		SoftLimit:     40,
		HardLimit:     50,
		OverLimitAction: "block",
	}, "t1")
	repo.usages["t1/users"] = &models.QuotaUsage{TenantID: "t1", Metric: "users", CurrentValue: 45}

	r, err := svc.CheckQuotaWithPolicy(context.Background(), "t1", &models.CheckWithPolicyRequest{
		Metric: "users", Amount: 20,
	})
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if r.HardLimit != 50 {
		t.Errorf("HardLimit = %d, want 50 (plan override)", r.HardLimit)
	}
	if !r.Blocking {
		t.Error("65 >= 50 should block")
	}
}

func TestTQ_CheckWithPolicy_NoCapSilentAllow(t *testing.T) {
	repo := newFakeTQRepo()
	svc := NewService(repo)

	// Insert a plan directly (bypass applyDefaults) so every limit stays 0.
	repo.plans["qp-nocap"] = &models.QuotaPlan{
		ID:              "qp-nocap",
		TenantID:        "t1",
		Name:            "nocap",
		OverLimitAction: "block",
		MaxUsers:        0,
	}
	repo.usages["t1/users"] = &models.QuotaUsage{TenantID: "t1", Metric: "users", CurrentValue: 999999}

	r, err := svc.CheckQuotaWithPolicy(context.Background(), "t1", &models.CheckWithPolicyRequest{
		Metric: "users", Amount: 10,
	})
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if !r.Allowed || r.Blocking {
		t.Errorf("no cap should always allow silently; got allowed=%v blocking=%v", r.Allowed, r.Blocking)
	}
	if len(r.Warning) != 0 {
		t.Errorf("no cap should not emit warnings; got %v", r.Warning)
	}
}

func TestTQ_CheckWithPolicy_NoPlanReturnsError(t *testing.T) {
	repo := newFakeTQRepo()
	svc := NewService(repo)

	_, err := svc.CheckQuotaWithPolicy(context.Background(), "t1", &models.CheckWithPolicyRequest{
		Metric: "users",
	})
	if err == nil {
		t.Fatal("expected error when no plan configured")
	}
}

func TestTQ_CheckWithPolicy_EmptyMetricReturnsError(t *testing.T) {
	repo := newFakeTQRepo()
	svc := NewService(repo)

	svc.CreatePlan(context.Background(), &models.CreatePlanRequest{Name: "test"}, "t1")
	_, err := svc.CheckQuotaWithPolicy(context.Background(), "t1", &models.CheckWithPolicyRequest{
		Metric: "",
	})
	if err == nil {
		t.Fatal("expected error when metric empty")
	}
}

func TestTQ_CheckWithPolicy_WarnThresholdsHitMultiple(t *testing.T) {
	repo := newFakeTQRepo()
	svc := NewService(repo)

	svc.CreatePlan(context.Background(), &models.CreatePlanRequest{
		Name:          "test",
		MaxUsers:      100,
		SoftLimit:     80,
		HardLimit:     100,
		OverLimitAction: "block",
		WarnThresholds: []int{50, 80, 95},
	}, "t1")
	// 96 / 100 = 96% → crosses 50, 80, 95.
	repo.usages["t1/users"] = &models.QuotaUsage{TenantID: "t1", Metric: "users", CurrentValue: 90}

	r, err := svc.CheckQuotaWithPolicy(context.Background(), "t1", &models.CheckWithPolicyRequest{
		Metric: "users", Amount: 6,
	})
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	want := []int{50, 80, 95}
	if len(r.WarnThresholdsHit) != len(want) {
		t.Fatalf("WarnThresholdsHit = %v, want %v", r.WarnThresholdsHit, want)
	}
	for i, v := range want {
		if r.WarnThresholdsHit[i] != v {
			t.Errorf("WarnThresholdsHit[%d] = %d, want %d", i, r.WarnThresholdsHit[i], v)
		}
	}
}

func TestTQ_CheckWithPolicy_WarnThresholdsHitPartial(t *testing.T) {
	repo := newFakeTQRepo()
	svc := NewService(repo)

	svc.CreatePlan(context.Background(), &models.CreatePlanRequest{
		Name:          "test",
		MaxUsers:      100,
		SoftLimit:     80,
		HardLimit:     100,
		OverLimitAction: "block",
		WarnThresholds: []int{50, 80, 95},
	}, "t1")
	// 60 / 100 = 60% → only crosses 50.
	repo.usages["t1/users"] = &models.QuotaUsage{TenantID: "t1", Metric: "users", CurrentValue: 55}

	r, err := svc.CheckQuotaWithPolicy(context.Background(), "t1", &models.CheckWithPolicyRequest{
		Metric: "users", Amount: 5,
	})
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if len(r.WarnThresholdsHit) != 1 || r.WarnThresholdsHit[0] != 50 {
		t.Errorf("WarnThresholdsHit = %v, want [50]", r.WarnThresholdsHit)
	}
}

func TestTQ_CheckWithPolicy_PlanIDOverride(t *testing.T) {
	repo := newFakeTQRepo()
	svc := NewService(repo)

	// Insert plans directly to sidestep generateID collisions within a
	// single test run (generateID only truncates to the minute).
	repo.plans["qp-primary"] = &models.QuotaPlan{
		ID:              "qp-primary",
		TenantID:        "t1",
		Name:            "primary",
		MaxUsers:        100,
		OverLimitAction: "block",
	}
	repo.plans["qp-restricted"] = &models.QuotaPlan{
		ID:              "qp-restricted",
		TenantID:        "t1",
		Name:            "restricted",
		MaxUsers:        50,
		OverLimitAction: "block",
	}

	repo.usages["t1/users"] = &models.QuotaUsage{TenantID: "t1", Metric: "users", CurrentValue: 40}

	// Under restricted (hard=50): projected 50 → blocked.
	r, err := svc.CheckQuotaWithPolicy(context.Background(), "t1", &models.CheckWithPolicyRequest{
		Metric: "users", Amount: 10, PlanID: "qp-restricted",
	})
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if r.PlanID != "qp-restricted" {
		t.Errorf("PlanID = %q, want qp-restricted", r.PlanID)
	}
	if !r.Blocking {
		t.Errorf("50 >= hard 50 should block under restricted; hard=%d soft=%d", r.HardLimit, r.SoftLimit)
	}

	// Under primary (hard=100): projected 50 → allowed.
	r2, err := svc.CheckQuotaWithPolicy(context.Background(), "t1", &models.CheckWithPolicyRequest{
		Metric: "users", Amount: 10, PlanID: "qp-primary",
	})
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if !r2.Allowed || r2.Blocking {
		t.Errorf("50 < hard 100 should be allowed under primary; hard=%d soft=%d", r2.HardLimit, r2.SoftLimit)
	}
}

func TestTQ_CheckWithPolicy_UnknownMetricFallsThrough(t *testing.T) {
	repo := newFakeTQRepo()
	svc := NewService(repo)

	svc.CreatePlan(context.Background(), &models.CreatePlanRequest{
		Name:          "test",
		OverLimitAction: "block",
	}, "t1")
	// metric "weird_metric" has no per-metric limit mapping → getLimitForMetric=0, no plan hard → no cap.
	r, err := svc.CheckQuotaWithPolicy(context.Background(), "t1", &models.CheckWithPolicyRequest{
		Metric: "weird_metric", Amount: 1000,
	})
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if !r.Allowed || r.Blocking {
		t.Errorf("unknown metric with no cap should allow silently")
	}
}

func TestTQ_ListAlertsByLevel_FiltersByLevel(t *testing.T) {
	repo := newFakeTQRepo()
	svc := NewService(repo)

	repo.alerts = []models.QuotaAlert{
		{ID: "a1", AlertLevel: "warning"},
		{ID: "a2", AlertLevel: "critical"},
		{ID: "a3", AlertLevel: "warning"},
	}

	all, err := svc.ListAlertsByLevel(context.Background(), "t1", "")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if len(all) != 3 {
		t.Errorf("no-filter count = %d, want 3", len(all))
	}

	warns, err := svc.ListAlertsByLevel(context.Background(), "t1", "warning")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if len(warns) != 2 {
		t.Errorf("warning count = %d, want 2", len(warns))
	}
	for _, a := range warns {
		if a.AlertLevel != "warning" {
			t.Errorf("unexpected level %q", a.AlertLevel)
		}
	}

	crits, err := svc.ListAlertsByLevel(context.Background(), "t1", "critical")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if len(crits) != 1 {
		t.Errorf("critical count = %d, want 1", len(crits))
	}
}

func TestTQ_ListAlertsByLevel_CaseInsensitive(t *testing.T) {
	repo := newFakeTQRepo()
	svc := NewService(repo)

	repo.alerts = []models.QuotaAlert{
		{ID: "a1", AlertLevel: "warning"},
		{ID: "a2", AlertLevel: "critical"},
	}
	out, err := svc.ListAlertsByLevel(context.Background(), "t1", " WARNING ")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if len(out) != 1 || out[0].ID != "a1" {
		t.Errorf("level filter should be case-insensitive and trim; got %v", out)
	}
}

func TestTQ_ListAlertsByLevel_UnknownLevelReturnsEmpty(t *testing.T) {
	repo := newFakeTQRepo()
	svc := NewService(repo)

	repo.alerts = []models.QuotaAlert{
		{ID: "a1", AlertLevel: "warning"},
		{ID: "a2", AlertLevel: "critical"},
	}
	out, err := svc.ListAlertsByLevel(context.Background(), "t1", "does-not-exist")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if out == nil {
		t.Error("unknown level should return empty slice, not nil")
	}
	if len(out) != 0 {
		t.Errorf("unknown level should filter to 0 alerts; got %d", len(out))
	}
}

func TestTQ_NormalizeOverLimitAction(t *testing.T) {
	cases := []struct{ in, want string }{
		{"block", "block"},
		{"BLOCK", "block"},
		{"warn", "warn"},
		{"WARN", "warn"},
		{"allow", "allow"},
		{"", "block"},
		{"weird", "block"},
		{" block ", "block"},
	}
	for _, c := range cases {
		if got := normalizeOverLimitAction(c.in); got != c.want {
			t.Errorf("normalizeOverLimitAction(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestTQ_NormalizeWarnThresholds_SortDedupClamp(t *testing.T) {
	got := normalizeWarnThresholds([]int{95, 50, 50, 80, -10, 150, 30})
	want := []int{0, 30, 50, 80, 95, 100}
	if len(got) != len(want) {
		t.Fatalf("got %v, want %v", got, want)
	}
	for i, v := range want {
		if got[i] != v {
			t.Errorf("got[%d] = %d, want %d", i, got[i], v)
		}
	}
}

func TestTQ_NormalizeWarnThresholds_Empty(t *testing.T) {
	got := normalizeWarnThresholds([]int{})
	if got != nil {
		t.Errorf("empty input should return nil; got %v", got)
	}
}

func TestTQ_JoinIntsAndParse(t *testing.T) {
	joined := joinInts([]int{50, 80, 95})
	if joined != "50,80,95" {
		t.Errorf("joinInts = %q, want 50,80,95", joined)
	}
	parsed := parseThresholds("95,50,80")
	want := []int{50, 80, 95}
	if len(parsed) != len(want) {
		t.Fatalf("parseThresholds = %v, want %v", parsed, want)
	}
	for i, v := range want {
		if parsed[i] != v {
			t.Errorf("parseThresholds[%d] = %d, want %d", i, parsed[i], v)
		}
	}
}

func TestTQ_ListUsage_calculatesPercentage(t *testing.T) {
	repo := newFakeTQRepo()
	svc := NewService(repo)

	svc.CreatePlan(context.Background(), &models.CreatePlanRequest{
		Name:               "test",
		APIRateLimitPerMin: 100,
	}, "t1")

	repo.usages["t1/api_rate_per_min"] = &models.QuotaUsage{
		TenantID:     "t1",
		Metric:       "api_rate_per_min",
		CurrentValue: 75,
	}

	usages, err := svc.ListUsage(context.Background(), "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if len(usages) != 1 {
		t.Fatalf("usages = %d, want 1", len(usages))
	}
	if usages[0].UsagePct != 75.0 {
		t.Errorf("UsagePct = %.1f, want 75.0", usages[0].UsagePct)
	}
	if usages[0].Status != "warning" {
		t.Errorf("Status = %q, want warning at 75%%", usages[0].Status)
	}
	if usages[0].Remaining != 25 {
		t.Errorf("Remaining = %d, want 25", usages[0].Remaining)
	}
}
