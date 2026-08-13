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