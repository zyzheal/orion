package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/finops-v2/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CheckBudgetAlerts(ctx context.Context, tenantID string) ([]models.BudgetAlert, error)
	CreateBudget(ctx context.Context, budget *models.Budget) (int, error)
	DeleteBudget(ctx context.Context, tenantID, id string) error
	DeleteRecommendation(ctx context.Context, tenantID string, id string) error
	DetectUnusedResources(ctx context.Context, tenantID string) ([]models.Recommendation, error)
	EstimateSavings(ctx context.Context, tenantID string) (*models.SavingsEstimate, error)
	ForecastBudget(ctx context.Context, tenantID, id string) (*models.BudgetForecastResponse, error)
	GetAlertTriggers(ctx context.Context) ([]models.AlertTrigger, error)
	GetBudget(ctx context.Context, tenantID, id string) (*models.Budget, error)
	GetBudgetStatus(ctx context.Context, tenantID, id string) (*models.BudgetStatusResponse, error)
	GetChargebackReport(ctx context.Context, tenantID string) ([]models.ChargebackEntry, error)
	GetCostBreakdown(ctx context.Context, tenantID, dimension string) ([]models.CostBreakdownItem, error)
	GetCostByEntity(ctx context.Context, tenantID, entityType, entityID string) ([]models.CostEntry, error)
	GetCostSummary(ctx context.Context, tenantID, period string) (*models.CostSummary, error)
	GetEntityCostTrend(ctx context.Context, tenantID, entityType, entityID, period string) ([]models.CostTrendPoint, error)
	GetROIHistory(ctx context.Context, tenantID string) ([]models.ROIEntry, error)
	GetROISummary(ctx context.Context, tenantID string) (*models.ROISummary, error)
	GetRegisteredProviders(ctx context.Context) ([]string, error)
	GetReportHistory(ctx context.Context, tenantID string) ([]models.Report, error)
	GetRightSizingRecommendations(ctx context.Context, tenantID string) ([]models.Recommendation, error)
	GetSchedule(ctx context.Context, provider string) (*models.CollectionSchedule, error)
	CollectCost(ctx context.Context, tenantID string, provider string, days int) (*models.CollectCostResponse, error)
	HealthCheckAlways(ctx context.Context) (bool, error)
	ListBudgets(ctx context.Context, tenantID string, limit, offset int) ([]models.Budget, error)
	ListRecommendations(ctx context.Context, tenantID string, limit, offset int) ([]models.Recommendation, error)
	SetSchedule(ctx context.Context, provider, cronExpression string, enabled bool) error
	TrackCost(ctx context.Context, e *models.CostEntry) (int, error)
	UpdateBudget(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	UpdateRecommendationStatus(ctx context.Context, tenantID string, id string, status string) error
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func (s *Service) TrackProjectCost(ctx context.Context, tenantID string, req models.TrackCostRequest) (*models.CostEntry, error) {
	return s.trackCost(ctx, tenantID, "project", req)
}

func (s *Service) TrackTenantCost(ctx context.Context, tenantID string, req models.TrackCostRequest) (*models.CostEntry, error) {
	return s.trackCost(ctx, tenantID, "tenant", req)
}

func (s *Service) TrackTeamCost(ctx context.Context, tenantID string, req models.TrackCostRequest) (*models.CostEntry, error) {
	return s.trackCost(ctx, tenantID, "team", req)
}

func (s *Service) trackCost(ctx context.Context, tenantID, entityType string, req models.TrackCostRequest) (*models.CostEntry, error) {
	if req.Cost < 0 {
		return nil, errors.New("cost cannot be negative")
	}
	if req.Currency == "" {
		req.Currency = "USD"
	}
	e := &models.CostEntry{
		TenantID:    tenantID,
		EntityID:    req.EntityID,
		EntityType:  entityType,
		Cost:        req.Cost,
		Currency:    req.Currency,
		Category:    req.Category,
		Provider:    req.Provider,
		PeriodStart: req.PeriodStart,
		PeriodEnd:   req.PeriodEnd,
		CreatedAt:   time.Now().UTC(),
	}
	id, err := s.repo.TrackCost(ctx, e)
	if err != nil {
		return nil, err
	}
	e.ID = id
	return e, nil
}

func (s *Service) GetCostByEntity(ctx context.Context, tenantID, entityType, entityID string) ([]models.CostEntry, error) {
	return s.repo.GetCostByEntity(ctx, tenantID, entityType, entityID)
}

func (s *Service) GetEntityCostTrend(ctx context.Context, tenantID, entityType, entityID, period string) (*models.CostTrend, error) {
	points, err := s.repo.GetEntityCostTrend(ctx, tenantID, entityType, entityID, period)
	if err != nil {
		return nil, err
	}
	return computeTrend(entityType, entityID, points), nil
}

func computeTrend(entityType, entityID string, points []models.CostTrendPoint) *models.CostTrend {
	t := &models.CostTrend{
		EntityID:   entityID,
		EntityType: entityType,
		Points:     points,
	}
	if len(points) == 0 {
		return t
	}
	total := 0.0
	var min, max, prev float64
	for i, p := range points {
		total += p.Cost
		if i == 0 {
			prev = p.Cost
			max, min = p.Cost, p.Cost
		} else {
			if p.Cost > max {
				max = p.Cost
			}
			if p.Cost < min {
				min = p.Cost
			}
		}
	}
	t.TotalCost = total
	t.AverageCost = total / float64(len(points))
	t.MaxCost = max
	t.MinCost = min
	if len(points) > 1 {
		first := points[0].Cost
		last := points[len(points)-1].Cost
		if first > 0 {
			t.OverallChangeRate = ((last - first) / first) * 100
		}
	}
	_ = prev
	return t
}

func (s *Service) GetCostSummary(ctx context.Context, tenantID, period string) (*models.CostSummary, error) {
	return s.repo.GetCostSummary(ctx, tenantID, period)
}

func (s *Service) GetCostBreakdown(ctx context.Context, tenantID, dimension string) (*models.CostBreakdownResponse, error) {
	items, err := s.repo.GetCostBreakdown(ctx, tenantID, dimension)
	if err != nil {
		return nil, err
	}
	return &models.CostBreakdownResponse{
		Dimension: dimension,
		Items:     items,
	}, nil
}

func (s *Service) GetChargebackReport(ctx context.Context, tenantID string) ([]models.ChargebackEntry, error) {
	return s.repo.GetChargebackReport(ctx, tenantID)
}

// --- Budget CRUD ---

func (s *Service) ListBudgets(ctx context.Context, tenantID string, limit, offset int) ([]models.Budget, error) {
	return s.repo.ListBudgets(ctx, tenantID, limit, offset)
}

func (s *Service) CreateBudget(ctx context.Context, tenantID string, req models.CreateBudgetRequest) (*models.Budget, error) {
	b := &models.Budget{
		TenantID:       tenantID,
		Name:           req.Name,
		EntityID:       req.EntityID,
		EntityType:     req.EntityType,
		Amount:         req.Amount,
		Period:         req.Period,
		Currency:       req.Currency,
		Category:       req.Category,
		AlertThreshold: req.AlertThreshold,
		Status:         "active",
		CreatedAt:      time.Now().UTC(),
		UpdatedAt:      time.Now().UTC(),
	}
	if b.Currency == "" {
		b.Currency = "USD"
	}
	id, err := s.repo.CreateBudget(ctx, b)
	if err != nil {
		return nil, err
	}
	b.ID = id
	return b, nil
}

func (s *Service) GetBudget(ctx context.Context, tenantID, id string) (*models.Budget, error) {
	return s.repo.GetBudget(ctx, tenantID, id)
}

func (s *Service) UpdateBudget(ctx context.Context, tenantID, id string, req models.UpdateBudgetRequest) (*models.Budget, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Amount != nil {
		updates["amount"] = *req.Amount
	}
	if req.Period != nil {
		updates["period"] = *req.Period
	}
	if req.AlertThreshold != nil {
		updates["alert_threshold"] = *req.AlertThreshold
	}
	if err := s.repo.UpdateBudget(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetBudget(ctx, tenantID, id)
}

func (s *Service) DeleteBudget(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteBudget(ctx, tenantID, id)
}

func (s *Service) GetBudgetStatus(ctx context.Context, tenantID, id string) (*models.BudgetStatusResponse, error) {
	return s.repo.GetBudgetStatus(ctx, tenantID, id)
}

func (s *Service) ForecastBudget(ctx context.Context, tenantID, id string) (*models.BudgetForecastResponse, error) {
	return s.repo.ForecastBudget(ctx, tenantID, id)
}

// --- Budget alerts ---

func (s *Service) CheckBudgetAlerts(ctx context.Context, tenantID string, entityID, entityType string) ([]models.BudgetAlert, error) {
	return s.repo.CheckBudgetAlerts(ctx, tenantID)
}

func (s *Service) GetAlertTriggers(ctx context.Context) ([]models.AlertTrigger, error) {
	return s.repo.GetAlertTriggers(ctx)
}

// --- Forecasts ---

func (s *Service) GetCostForecast(ctx context.Context, tenantID, entityType, entityID, period string) (*models.CostForecast, error) {
	trend, err := s.GetEntityCostTrend(ctx, tenantID, entityType, entityID, period)
	if err != nil {
		return nil, err
	}
	nextPeriod := 0.0
	if len(trend.Points) > 0 {
		nextPeriod = trend.Points[len(trend.Points)-1].Cost * (1 + trend.OverallChangeRate/100)
	}
	return &models.CostForecast{
		EntityID:           entityID,
		EntityType:         entityType,
		Period:             period,
		NextPeriodForecast: nextPeriod,
		Points:             trend.Points,
		AverageCost:        trend.AverageCost,
		MaxCost:            trend.MaxCost,
		MinCost:            trend.MinCost,
		OverallChangeRate:  trend.OverallChangeRate,
	}, nil
}

// --- Recommendations ---

func (s *Service) ListRecommendations(ctx context.Context, tenantID string) ([]models.Recommendation, error) {
	return s.repo.ListRecommendations(ctx, tenantID, 50, 0)
}

func (s *Service) UpdateRecommendationStatus(ctx context.Context, tenantID, id string, req models.UpdateRecommendationRequest) error {
	validStatuses := map[string]bool{
		"in_progress": true, "implemented": true, "dismissed": true, "open": true,
	}
	if !validStatuses[req.Status] {
		return errors.New("invalid recommendation status")
	}
	return s.repo.UpdateRecommendationStatus(ctx, tenantID, id, req.Status)
}

func (s *Service) DeleteRecommendation(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteRecommendation(ctx, tenantID, id)
}

func (s *Service) GetRightSizingRecommendations(ctx context.Context, tenantID string) ([]models.RightSizingRecommendation, error) {
	recommendations, err := s.repo.GetRightSizingRecommendations(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	var items []models.RightSizingRecommendation
	for _, r := range recommendations {
		items = append(items, models.RightSizingRecommendation{
			ResourceName:     r.EntityID,
			ResourceType:     r.EntityType,
			CurrentSpec:      r.Title,
			RecommendedSpec:  r.Description,
			EstimatedSavings: r.EstimatedSavings,
		})
	}
	return items, nil
}

func (s *Service) DetectUnusedResources(ctx context.Context, tenantID string) ([]models.UnusedResource, error) {
	recommendations, err := s.repo.DetectUnusedResources(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	var items []models.UnusedResource
	for _, r := range recommendations {
		items = append(items, models.UnusedResource{
			ResourceName:     r.EntityID,
			ResourceType:     r.EntityType,
			MonthlyCost:      r.EstimatedSavings,
			SavingsIfRemoved: r.EstimatedSavings,
		})
	}
	return items, nil
}

func (s *Service) EstimateSavings(ctx context.Context, tenantID string) (*models.SavingsEstimate, error) {
	return s.repo.EstimateSavings(ctx, tenantID)
}

// --- Reports ---

func (s *Service) GetReportHistory(ctx context.Context, tenantID string) ([]models.Report, error) {
	return s.repo.GetReportHistory(ctx, tenantID)
}

// --- ROI ---

func (s *Service) GetROIHistory(ctx context.Context, tenantID string) ([]models.ROIEntry, error) {
	return s.repo.GetROIHistory(ctx, tenantID)
}

func (s *Service) GetROISummary(ctx context.Context, tenantID string) (*models.ROISummary, error) {
	return s.repo.GetROISummary(ctx, tenantID)
}

// --- Metrics (KPIs) ---

func (s *Service) GetMetrics(ctx context.Context, tenantID string) (*models.FinOpsMetricsResponse, error) {
	summary, _ := s.GetCostSummary(ctx, tenantID, "monthly")
	roi, _ := s.GetROISummary(ctx, tenantID)
	savings, _ := s.EstimateSavings(ctx, tenantID)
	return &models.FinOpsMetricsResponse{
		CostMetrics:    *summary,
		ROIMetrics:     *roi,
		SavingsMetrics: *savings,
	}, nil
}

// --- Cost collection ---

func (s *Service) GetRegisteredProviders(ctx context.Context) ([]models.CloudProviderEntry, error) {
	providers, err := s.repo.GetRegisteredProviders(ctx)
	if err != nil {
		return nil, err
	}
	var items []models.CloudProviderEntry
	for _, p := range providers {
		items = append(items, models.CloudProviderEntry{Name: p, Enabled: true})
	}
	return items, nil
}

func (s *Service) SetSchedule(ctx context.Context, provider, cronExpression string, enabled bool) error {
	return s.repo.SetSchedule(ctx, provider, cronExpression, enabled)
}

func (s *Service) GetSchedule(ctx context.Context, provider string) (*models.CollectionSchedule, error) {
	return s.repo.GetSchedule(ctx, provider)
}

// CollectCost collects cost data for the given provider over the past N days,
// returning the number of entries collected and their total cost.
func (s *Service) CollectCost(ctx context.Context, tenantID string, req models.CollectCostRequest) (*models.CollectCostResponse, error) {
	days := req.Days
	if days <= 0 {
		days = 30
	}
	resp, err := s.repo.CollectCost(ctx, tenantID, req.Provider, days)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// --- Health check ---

func (s *Service) HealthCheck(ctx context.Context) (bool, error) {
	return s.repo.HealthCheckAlways(ctx)
}

// Sentinel errors
var ErrBudgetNotFound = errors.New("budget not found")

func IsNotFound(err error) bool {
	return errors.Is(err, ErrBudgetNotFound) || errors.Is(err, context.DeadlineExceeded)
}

func ErrNotFoundResource(name, id string) error {
	return fmt.Errorf("%s %q not found", name, id)
}
