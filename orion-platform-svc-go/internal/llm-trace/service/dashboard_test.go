package service

import (
	"context"
	"testing"
	"time"

	"orion/platform-svc-go/internal/llm-trace/models"
)

func Test_Round2f(t *testing.T) {
	cases := []struct{ in, want float64 }{
		{0.12345, 0.12},
		{1.2345, 1.23},
		{2.999, 3},
		{0.005, 0.01},
	}
	for _, c := range cases {
		if got := round2f(c.in); got != c.want {
			t.Errorf("round2f(%v) = %v, want %v", c.in, got, c.want)
		}
	}
}

func Test_NormalizeModel(t *testing.T) {
	if got := normalizeModel("  gpt-4o  "); got != "gpt-4o" {
		t.Fatalf("normalizeModel = %q", got)
	}
}

// mockDashboardRepo stubs the repository for dashboard aggregation tests.
type mockDashboardRepo struct {
	traces []models.LLMTrace
}

func (m *mockDashboardRepo) ListTracesByTenantAndDateRange(ctx context.Context, tenantID string, start, end *time.Time) ([]models.LLMTrace, error) {
	filtered := make([]models.LLMTrace, 0)
	for _, tr := range m.traces {
		if start != nil && tr.CreatedAt.Before(*start) {
			continue
		}
		if end != nil && tr.CreatedAt.After(*end) {
			continue
		}
		filtered = append(filtered, tr)
	}
	return filtered, nil
}

func (m *mockDashboardRepo) CountTracesByTenant(ctx context.Context, tenantID string, q *models.ListTracesQuery) (int64, error) {
	return int64(len(m.traces)), nil
}
func (m *mockDashboardRepo) CreateTrace(ctx context.Context, t *models.LLMTrace) error { return nil }
func (m *mockDashboardRepo) GetCustomPricing(ctx context.Context, modelID string) (*models.ModelPricing, error) {
	return &models.ModelPricing{}, nil
}
func (m *mockDashboardRepo) GetDailyStats(ctx context.Context, tenantID, dateStr string) (*models.DailyStats, error) {
	return &models.DailyStats{}, nil
}
func (m *mockDashboardRepo) GetTrace(ctx context.Context, traceID, tenantID string) (*models.LLMTrace, error) {
	return nil, nil
}
func (m *mockDashboardRepo) GetTrackingAccuracy(ctx context.Context, tenantID string) (*models.TrackingAccuracy, error) {
	return &models.TrackingAccuracy{}, nil
}
func (m *mockDashboardRepo) ListTracesByTenant(ctx context.Context, tenantID string, q *models.ListTracesQuery) ([]models.LLMTrace, error) {
	return m.traces, nil
}
func (m *mockDashboardRepo) UpdateTrace(ctx context.Context, traceID, tenantID string, fields map[string]interface{}) error {
	return nil
}

func Test_GetUsageDashboard_Aggregation(t *testing.T) {
	now := time.Now().UTC()
	svc := &Service{
		repo:     &mockDashboardRepo{},
		currency: "CNY",
	}
	mock, _ := svc.repo.(*mockDashboardRepo)
	mock.traces = []models.LLMTrace{
		{TenantID: "t1", ModelID: "gpt-4o", TotalTokens: 100, TotalCost: 1.0, Status: models.TraceStatusCompleted, CreatedAt: now.Add(-24 * time.Hour)},
		{TenantID: "t1", ModelID: "gpt-4o", TotalTokens: 50, TotalCost: 0.5, Status: models.TraceStatusFailed, CreatedAt: now.Add(-24 * time.Hour)},
		{TenantID: "t1", ModelID: "claude", TotalTokens: 200, TotalCost: 2.0, Status: models.TraceStatusCompleted, CreatedAt: now.Add(-48 * time.Hour)},
	}

	start := now.Add(-72 * time.Hour)
	end := now.Add(time.Hour)
	dash, err := svc.GetUsageDashboard(context.Background(), "t1", &start, &end)
	if err != nil {
		t.Fatal(err)
	}
	if dash.TotalRequests != 3 {
		t.Fatalf("total requests = %d, want 3", dash.TotalRequests)
	}
	if dash.TotalCost != 3.5 {
		t.Fatalf("total cost = %v, want 3.5", dash.TotalCost)
	}
	// tenant-scoped requests drop byTenant
	if dash.ByTenant != nil {
		t.Fatal("byTenant should be nil for tenant-scoped request")
	}
	// per-model aggregation
	if len(dash.ByModel) != 2 {
		t.Fatalf("byModel keys = %d, want 2", len(dash.ByModel))
	}
	if dash.ByModel["gpt-4o"].SuccessRate != 0.5 {
		t.Fatalf("gpt-4o success rate = %v, want 0.5", dash.ByModel["gpt-4o"].SuccessRate)
	}
	// per-day aggregation (2 distinct days)
	if len(dash.ByDay) != 2 {
		t.Fatalf("byDay days = %d, want 2", len(dash.ByDay))
	}
	// trend projection present
	if dash.Trend == nil || dash.Trend.ProjectedMonthly <= 0 {
		t.Fatal("expected non-empty trend projection")
	}
}

func Test_GetUsageDashboard_MultiTenantView(t *testing.T) {
	now := time.Now().UTC()
	svc := &Service{repo: &mockDashboardRepo{}, currency: "USD"}
	mock, _ := svc.repo.(*mockDashboardRepo)
	mock.traces = []models.LLMTrace{
		{TenantID: "t1", ModelID: "m1", TotalTokens: 10, TotalCost: 0.1, Status: models.TraceStatusCompleted, CreatedAt: now},
		{TenantID: "t2", ModelID: "m1", TotalTokens: 20, TotalCost: 0.2, Status: models.TraceStatusCompleted, CreatedAt: now},
	}
	start := now.Add(-24 * time.Hour)
	end := now.Add(time.Hour)
	dash, err := svc.GetUsageDashboard(context.Background(), "", &start, &end)
	if err != nil {
		t.Fatal(err)
	}
	if len(dash.ByTenant) != 2 {
		t.Fatalf("byTenant keys = %d, want 2", len(dash.ByTenant))
	}
}

func Test_HasCostData_Guard(t *testing.T) {
	if hasCostData(nil) {
		t.Fatal("nil dashboard should not have cost data")
	}
	if hasCostData(&models.UsageDashboard{}) {
		t.Fatal("empty dashboard should not have cost data")
	}
	if !hasCostData(&models.UsageDashboard{TotalRequests: 1}) {
		t.Fatal("request with trace should have cost data")
	}
}
