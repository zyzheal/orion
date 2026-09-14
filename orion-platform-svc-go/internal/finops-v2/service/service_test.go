package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"testing"

	"orion/platform-svc-go/internal/finops-v2/models"
)

func TestService_NilRepo(t *testing.T) {
	s := NewService(nil)
	if s == nil {
		t.Fatal("expected non-nil service")
	}
}

// fakeRepo records the arguments it was called with so a dropped parameter shows
// up as a test failure instead of a silently wider query.
type fakeRepo struct {
	getBudgetErr         error
	getCostSummary       *models.CostSummary
	getCostSummaryErr    error
	roi                  *models.ROISummary
	roiErr               error
	savings              *models.SavingsEstimate
	savingsErr           error
	providers            []string
	providersErr         error
	lastProvidersTenant  string
	schedules            map[string]models.CollectionSchedule
	healthOK             bool
	healthErr            error
	healthCalls          int
	alerts               []models.BudgetAlert
	lastAlertsEntityID   string
	lastAlertsEntityType string
	lastAlertsTenant     string
	triggers             []models.AlertTrigger
	triggersErr          error
	lastTriggersTenant   string
	trend                []models.CostTrendPoint
	trendErr             error
	costEntry            *models.CostEntry
	trackErr             error
	lastTrackEntity      string
	trackCalls           int
	lastBudget           *models.Budget
	lastCollectProvider  string
	lastCollectDays      int
}

func (f *fakeRepo) GetBudget(ctx context.Context, tenantID, id string) (*models.Budget, error) {
	return nil, f.getBudgetErr
}
func (f *fakeRepo) GetCostSummary(ctx context.Context, tenantID string) (*models.CostSummary, error) {
	if f.getCostSummaryErr != nil {
		return nil, f.getCostSummaryErr
	}
	if f.getCostSummary == nil {
		return &models.CostSummary{TenantID: tenantID}, nil
	}
	return f.getCostSummary, nil
}
func (f *fakeRepo) GetROISummary(ctx context.Context, tenantID string) (*models.ROISummary, error) {
	return f.roi, f.roiErr
}
func (f *fakeRepo) EstimateSavings(ctx context.Context, tenantID string) (*models.SavingsEstimate, error) {
	return f.savings, f.savingsErr
}
func (f *fakeRepo) GetRegisteredProviders(ctx context.Context, tenantID string) ([]string, error) {
	f.lastProvidersTenant = tenantID
	return f.providers, f.providersErr
}
func (f *fakeRepo) GetSchedule(ctx context.Context, provider string) (*models.CollectionSchedule, error) {
	s, ok := f.schedules[provider]
	if !ok {
		return nil, sql.ErrNoRows
	}
	return &s, nil
}
func (f *fakeRepo) HealthCheck(ctx context.Context) (bool, error) {
	f.healthCalls++
	return f.healthOK, f.healthErr
}
func (f *fakeRepo) CheckBudgetAlerts(ctx context.Context, tenantID, entityID, entityType string) ([]models.BudgetAlert, error) {
	f.lastAlertsTenant, f.lastAlertsEntityID, f.lastAlertsEntityType = tenantID, entityID, entityType
	return f.alerts, nil
}
func (f *fakeRepo) GetAlertTriggers(ctx context.Context, tenantID string) ([]models.AlertTrigger, error) {
	f.lastTriggersTenant = tenantID
	return f.triggers, f.triggersErr
}
func (f *fakeRepo) GetEntityCostTrend(ctx context.Context, tenantID, entityType, entityID string) ([]models.CostTrendPoint, error) {
	return f.trend, f.trendErr
}
func (f *fakeRepo) TrackCost(ctx context.Context, e *models.CostEntry) (int, error) {
	f.trackCalls++
	f.lastTrackEntity = e.EntityType
	f.costEntry = e
	return 9, f.trackErr
}
func (f *fakeRepo) CollectCost(ctx context.Context, tenantID string, provider string, days int) (*models.CollectCostResponse, error) {
	f.lastCollectProvider, f.lastCollectDays = provider, days
	return &models.CollectCostResponse{Collected: 1, Provider: provider}, nil
}
func (f *fakeRepo) CreateBudget(ctx context.Context, budget *models.Budget) (int, error) {
	f.lastBudget = budget
	return 1, nil
}
func (f *fakeRepo) ListBudgets(ctx context.Context, tenantID string, limit, offset int) ([]models.Budget, error) {
	return nil, nil
}
func (f *fakeRepo) DeleteBudget(ctx context.Context, tenantID, id string) error { return nil }
func (f *fakeRepo) UpdateBudget(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	return nil
}
func (f *fakeRepo) GetBudgetStatus(ctx context.Context, tenantID, id string) (*models.BudgetStatusResponse, error) {
	return &models.BudgetStatusResponse{}, nil
}
func (f *fakeRepo) ForecastBudget(ctx context.Context, tenantID, id string) (*models.BudgetForecastResponse, error) {
	return &models.BudgetForecastResponse{}, nil
}
func (f *fakeRepo) GetCostBreakdown(ctx context.Context, tenantID, dimension string) ([]models.CostBreakdownItem, error) {
	return nil, nil
}
func (f *fakeRepo) GetCostByEntity(ctx context.Context, tenantID, entityType, entityID string) ([]models.CostEntry, error) {
	return nil, nil
}
func (f *fakeRepo) GetChargebackReport(ctx context.Context, tenantID string) ([]models.ChargebackEntry, error) {
	return nil, nil
}
func (f *fakeRepo) ListRecommendations(ctx context.Context, tenantID string, limit, offset int) ([]models.Recommendation, error) {
	return nil, nil
}
func (f *fakeRepo) DeleteRecommendation(ctx context.Context, tenantID string, id string) error {
	return nil
}
func (f *fakeRepo) GetRightSizingRecommendations(ctx context.Context, tenantID string) ([]models.Recommendation, error) {
	return nil, nil
}
func (f *fakeRepo) DetectUnusedResources(ctx context.Context, tenantID string) ([]models.Recommendation, error) {
	return nil, nil
}
func (f *fakeRepo) UpdateRecommendationStatus(ctx context.Context, tenantID string, id string, status string) error {
	return nil
}
func (f *fakeRepo) GetReportHistory(ctx context.Context, tenantID string) ([]models.Report, error) {
	return nil, nil
}
func (f *fakeRepo) GetROIHistory(ctx context.Context, tenantID string) ([]models.ROIEntry, error) {
	return nil, nil
}
func (f *fakeRepo) SetSchedule(ctx context.Context, provider, cronExpression string, enabled bool) error {
	return nil
}

// --- error classification ---

func TestGetBudgetTranslatesNoRows(t *testing.T) {
	f := &fakeRepo{getBudgetErr: sql.ErrNoRows}
	s := NewService(f)

	_, err := s.GetBudget(context.Background(), "tenant-1", "9")
	if !errors.Is(err, ErrBudgetNotFound) {
		t.Fatalf("want ErrBudgetNotFound, got %v", err)
	}
}

func TestGetBudgetPassesThroughAnOutage(t *testing.T) {
	outage := errors.New("pq: connection refused")
	s := NewService(&fakeRepo{getBudgetErr: outage})

	_, err := s.GetBudget(context.Background(), "tenant-1", "9")
	if !errors.Is(err, outage) {
		t.Fatalf("want the original error preserved, got %v", err)
	}
}

func TestIsNotFoundDistinguishesNotFoundFromAnOutage(t *testing.T) {
	for _, tc := range []struct {
		name string
		err  error
		want bool
	}{
		{"sentinel", ErrBudgetNotFound, true},
		{"wrapped sentinel", fmt.Errorf("budget lookup: %w", ErrBudgetNotFound), true},
		{"sql ErrNoRows", sql.ErrNoRows, true},
		{"wrapped ErrNoRows", fmt.Errorf("row: %w", sql.ErrNoRows), true},
		{"deadline", context.DeadlineExceeded, false},
		{"outage", errors.New("pq: connection refused"), false},
	} {
		if got := IsNotFound(tc.err); got != tc.want {
			t.Errorf("%s: IsNotFound(%v) = %v, want %v", tc.name, tc.err, got, tc.want)
		}
	}
}

// --- GetMetrics: a repository error must surface, never panic ---

func TestGetMetricsPropagatesEveryRepositoryError(t *testing.T) {
	outage := errors.New("pq: canceling statement due to user request")
	for _, tc := range []struct {
		name string
		repo *fakeRepo
	}{
		{"cost summary", &fakeRepo{getCostSummaryErr: outage}},
		{"roi summary", &fakeRepo{roiErr: outage}},
		{"savings estimate", &fakeRepo{savingsErr: outage}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s := NewService(tc.repo)
			resp, err := s.GetMetrics(context.Background(), "tenant-1")
			if err == nil {
				t.Fatalf("want an error, got a success response %+v", resp)
			}
			if resp != nil {
				t.Fatalf("want nil response on error, got %+v", resp)
			}
			if !errors.Is(err, outage) {
				t.Fatalf("want the underlying error preserved, got %v", err)
			}
		})
	}
}

func TestGetMetricsEchoesThePeriodAndMergesTheThreeSections(t *testing.T) {
	f := &fakeRepo{
		getCostSummary: &models.CostSummary{TotalCost: 5000},
		roi:            &models.ROISummary{TotalSpend: 100, TotalSavings: 40},
		savings:        &models.SavingsEstimate{TotalPotentialSavings: 120},
	}
	resp, err := NewService(f).GetMetrics(context.Background(), "tenant-1")
	if err != nil {
		t.Fatalf("GetMetrics: %v", err)
	}
	// The repository does not know the caller's period: the service must stamp it.
	if resp.CostMetrics.Period != "monthly" || resp.CostMetrics.TotalCost != 5000 {
		t.Fatalf("CostMetrics = %+v", resp.CostMetrics)
	}
	if resp.ROIMetrics.TotalSpend != 100 || resp.ROIMetrics.TotalSavings != 40 {
		t.Fatalf("ROIMetrics = %+v", resp.ROIMetrics)
	}
	if resp.SavingsMetrics.TotalPotentialSavings != 120 {
		t.Fatalf("SavingsMetrics = %+v", resp.SavingsMetrics)
	}
}

// --- period is a display label, echoed by the service ---

func TestGetCostSummaryEchoesThePeriod(t *testing.T) {
	s := NewService(&fakeRepo{getCostSummary: &models.CostSummary{TenantID: "tenant-1"}})
	cs, err := s.GetCostSummary(context.Background(), "tenant-1", "quarterly")
	if err != nil {
		t.Fatalf("GetCostSummary: %v", err)
	}
	if cs.Period != "quarterly" {
		t.Fatalf("Period=%q, want quarterly", cs.Period)
	}
}

func TestGetEntityCostTrendEchoesThePeriod(t *testing.T) {
	f := &fakeRepo{trend: []models.CostTrendPoint{{Period: "2026-07", Cost: 10}, {Period: "2026-08", Cost: 12}}}
	trend, err := NewService(f).GetEntityCostTrend(context.Background(), "tenant-1", "project", "proj-1", "monthly")
	if err != nil {
		t.Fatalf("GetEntityCostTrend: %v", err)
	}
	if trend.Period != "monthly" {
		t.Fatalf("Period=%q", trend.Period)
	}
	if trend.TotalCost != 22 || trend.AverageCost != 11 || trend.MaxCost != 12 || trend.MinCost != 10 {
		t.Fatalf("unexpected aggregates: %+v", trend)
	}
}

func TestComputeTrend(t *testing.T) {
	trend := computeTrend("project", "proj-1", []models.CostTrendPoint{
		{Period: "1", Cost: 100}, {Period: "2", Cost: 40}, {Period: "3", Cost: 160},
	})
	if trend.TotalCost != 300 || trend.AverageCost != 100 || trend.MaxCost != 160 || trend.MinCost != 40 {
		t.Fatalf("unexpected: %+v", trend)
	}
	// (160-100)/100 = 60%. A dead implementation that skipped the first point
	// would report a different rate, which is what this pin is for.
	if trend.OverallChangeRate != 60 {
		t.Fatalf("OverallChangeRate=%v, want 60", trend.OverallChangeRate)
	}
	if empty := computeTrend("project", "p", nil); empty.TotalCost != 0 || len(empty.Points) != 0 {
		t.Fatalf("empty trend = %+v", empty)
	}
}

// --- dropped parameters must be visible ---

func TestCheckBudgetAlertsForwardsTheEntityFilter(t *testing.T) {
	f := &fakeRepo{alerts: []models.BudgetAlert{{BudgetID: 1}}}
	if _, err := NewService(f).CheckBudgetAlerts(context.Background(), "tenant-1", "proj-1", "project"); err != nil {
		t.Fatalf("CheckBudgetAlerts: %v", err)
	}
	if f.lastAlertsTenant != "tenant-1" || f.lastAlertsEntityID != "proj-1" || f.lastAlertsEntityType != "project" {
		t.Fatalf("got tenant=%q entityID=%q entityType=%q", f.lastAlertsTenant, f.lastAlertsEntityID, f.lastAlertsEntityType)
	}
}

func TestGetAlertTriggersForwardsTheTenant(t *testing.T) {
	f := &fakeRepo{triggers: []models.AlertTrigger{{BudgetID: 2}}}
	if _, err := NewService(f).GetAlertTriggers(context.Background(), "tenant-1"); err != nil {
		t.Fatalf("GetAlertTriggers: %v", err)
	}
	if f.lastTriggersTenant != "tenant-1" {
		t.Fatalf("tenant=%q, want tenant-1", f.lastTriggersTenant)
	}
}

func TestGetRegisteredProvidersForwardsTheTenantAndReadsEnabled(t *testing.T) {
	f := &fakeRepo{
		providers: []string{"aws", "azure"},
		schedules: map[string]models.CollectionSchedule{
			"aws": {Provider: "aws", Enabled: true},
		},
	}
	items, err := NewService(f).GetRegisteredProviders(context.Background(), "tenant-1")
	if err != nil {
		t.Fatalf("GetRegisteredProviders: %v", err)
	}
	if f.lastProvidersTenant != "tenant-1" {
		t.Fatalf("tenant=%q, want tenant-1", f.lastProvidersTenant)
	}
	if len(items) != 2 || items[0].Name != "aws" || !items[0].Enabled {
		t.Fatalf("aws must read its schedule: %+v", items)
	}
	if items[1].Name != "azure" || items[1].Enabled {
		t.Fatalf("azure has no schedule, so Enabled must be false: %+v", items)
	}
}

func TestHealthCheckHitsTheRepositoryCheck(t *testing.T) {
	for _, want := range []bool{true, false} {
		f := &fakeRepo{healthOK: want}
		got, err := NewService(f).HealthCheck(context.Background())
		if err != nil {
			t.Fatalf("HealthCheck: %v", err)
		}
		if got != want {
			t.Fatalf("want %v, got %v", want, got)
		}
		if f.healthCalls != 1 {
			t.Fatalf("HealthCheck called the repository %d times, want 1", f.healthCalls)
		}
	}
}

func TestTrackCostPersistsTheDetailsAndTheEntityKind(t *testing.T) {
	f := &fakeRepo{}
	got, err := NewService(f).TrackProjectCost(context.Background(), "tenant-1", models.TrackCostRequest{
		EntityID: "proj-1", Cost: 12.5, Category: "compute", Provider: "aws",
		Details:     "node auto-scaling",
		PeriodStart: "2026-09-01", PeriodEnd: "2026-09-30",
	})
	if err != nil {
		t.Fatalf("TrackProjectCost: %v", err)
	}
	if got.ID != 9 || f.trackCalls != 1 {
		t.Fatalf("id=%d calls=%d", got.ID, f.trackCalls)
	}
	if f.lastTrackEntity != "project" {
		t.Fatalf("EntityType=%q, want project", f.lastTrackEntity)
	}
	if f.costEntry.Details != "node auto-scaling" || f.costEntry.Currency != "USD" {
		t.Fatalf("CostEntry = %+v", f.costEntry)
	}
	if _, err := NewService(&fakeRepo{}).TrackTeamCost(context.Background(), "tenant-1", models.TrackCostRequest{
		EntityID: "t", Cost: -1, PeriodStart: "a", PeriodEnd: "b",
	}); err == nil {
		t.Fatal("a negative cost must be rejected")
	}
}

func TestCollectCostDefaultsTheLookbackWindow(t *testing.T) {
	for _, days := range []int{0, -5, 90} {
		f := &fakeRepo{}
		if _, err := NewService(f).CollectCost(context.Background(), "tenant-1", models.CollectCostRequest{
			Provider: "aws", Days: days,
		}); err != nil {
			t.Fatalf("CollectCost: %v", err)
		}
		want := days
		if days <= 0 {
			want = 30
		}
		if f.lastCollectDays != want || f.lastCollectProvider != "aws" {
			t.Fatalf("days=%d in: repo got days=%d provider=%q", days, f.lastCollectDays, f.lastCollectProvider)
		}
	}
}

func TestCreateBudgetDefaultsCurrencyAndStatus(t *testing.T) {
	f := &fakeRepo{}
	got, err := NewService(f).CreateBudget(context.Background(), "tenant-1", models.CreateBudgetRequest{
		Name: "infra", EntityID: "proj-1", EntityType: "project", Amount: 1000,
	})
	if err != nil {
		t.Fatalf("CreateBudget: %v", err)
	}
	if got.Currency != "USD" || got.Status != "active" {
		t.Fatalf("budget = %+v", got)
	}
	if f.lastBudget.Currency != "USD" || f.lastBudget.Status != "active" {
		t.Fatalf("persisted budget = %+v", f.lastBudget)
	}
}

func TestUpdateRecommendationStatusRejectsAnUnknownStatus(t *testing.T) {
	if err := NewService(&fakeRepo{}).UpdateRecommendationStatus(context.Background(), "tenant-1", "1",
		models.UpdateRecommendationRequest{Status: "exploded"}); err == nil {
		t.Fatal("an unknown status must be rejected")
	}
}
