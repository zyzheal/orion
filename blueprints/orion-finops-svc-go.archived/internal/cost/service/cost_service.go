package service

import (
	"context"
	"errors"
	"time"

	"orion/finops-svc-go/internal/cost/models"
	"orion/finops-svc-go/internal/cost/repository"

	"go.uber.org/zap"
)

var (
	ErrInvalidTenantID = errors.New("tenant ID required")
	ErrNotFound        = errors.New("record not found")
)

// CostService handles cost aggregation and querying by resource, time, and tenant.
type CostService struct {
	repo       *repository.CostRepository
	optSvc     *OptimizationService
	logger     *zap.Logger
}

// NewCostService creates a new cost service instance.
func NewCostService(repo *repository.CostRepository, optSvc *OptimizationService, logger *zap.Logger) *CostService {
	return &CostService{repo: repo, optSvc: optSvc, logger: logger}
}

// RecordCost inserts a cost record for a tenant.
func (s *CostService) RecordCost(ctx context.Context, req *models.RecordCostRequest) error {
	if req.TenantID == "" {
		return ErrInvalidTenantID
	}

	date := time.Now()
	if req.Date != "" {
		parsed, err := time.Parse("2006-01-02", req.Date)
		if err == nil {
			date = parsed
		}
	}

	resourceID := (*string)(nil)
	if req.ResourceID != "" {
		resourceID = &req.ResourceID
	}

	region := (*string)(nil)
	if req.Region != "" {
		region = &req.Region
	}

	record := &models.CostRecord{
		TenantID:   req.TenantID,
		Date:       date,
		Service:    req.Service,
		ResourceID: resourceID,
		Region:     region,
		Cost:       req.Cost,
		Currency:   req.Currency,
		Category:   req.Category,
		Tags:       req.Tags,
	}

	err := s.repo.CreateCostRecord(ctx, record)
	if err != nil {
		s.logger.Error("failed to create cost record", zap.Error(err))
		return err
	}

	s.logger.Info("cost record created", zap.String("tenant_id", req.TenantID), zap.Float64("cost", req.Cost))
	return nil
}

// ListCosts retrieves paginated cost records with optional filters.
func (s *CostService) ListCosts(ctx context.Context, tenantID string, filter *models.ListCostsRequest, offset, limit int) ([]models.CostRecord, error) {
	repoFilter := &repository.ListFilter{
		StartDate:  filter.StartDate,
		EndDate:    filter.EndDate,
		Service:    filter.Service,
		ResourceID: filter.ResourceID,
		Region:     filter.Region,
	}

	return s.repo.FindCostRecords(ctx, tenantID, repoFilter, offset, limit)
}

// GetTotalCost returns the total cost for a tenant in a date range.
func (s *CostService) GetTotalCost(ctx context.Context, tenantID, startDate, endDate string) (float64, error) {
	return s.repo.GetTotalCost(ctx, tenantID, startDate, endDate)
}

// GetCostByService returns cost aggregated by service.
func (s *CostService) GetCostByService(ctx context.Context, tenantID, startDate, endDate string) ([]models.CostAggregation, error) {
	return s.repo.GetCostByService(ctx, tenantID, startDate, endDate)
}

// GetCostByResource returns cost aggregated by resource.
func (s *CostService) GetCostByResource(ctx context.Context, tenantID, startDate, endDate string) ([]models.CostAggregation, error) {
	return s.repo.GetCostByResource(ctx, tenantID, startDate, endDate)
}

// GetCostSummary returns aggregated cost summary across dimensions.
func (s *CostService) GetCostSummary(ctx context.Context, tenantID, startDate, endDate string) (*models.CostSummary, error) {
	return s.repo.GetCostSummary(ctx, tenantID, startDate, endDate)
}

// GetCostTrend returns daily cost trend for a period.
func (s *CostService) GetCostTrend(ctx context.Context, tenantID, startDate, endDate string) (*models.CostTrendResult, error) {
	points, err := s.repo.GetDailyCostTrend(ctx, tenantID, startDate, endDate)
	if err != nil {
		return nil, err
	}

	if len(points) == 0 {
		return &models.CostTrendResult{
			Points: points,
			TotalCost: 0,
			AverageCost: 0,
			Trend: "stable",
			ChangeRate: 0,
		}, nil
	}

	totalCost := 0.0
	for _, p := range points {
		totalCost += p.Cost
	}
	averageCost := totalCost / float64(len(points))

	trend := calculateTrend(points)
	changeRate := calculateChangeRate(points)

	return &models.CostTrendResult{
		Points:      points,
		TotalCost:   roundFloat(totalCost),
		AverageCost: roundFloat(averageCost),
		Trend:       trend,
		ChangeRate:  roundFloat(changeRate),
	}, nil
}

func calculateTrend(points []models.CostTrendPoint) string {
	if len(points) < 2 {
		return "stable"
	}

	mid := len(points) / 2
	firstHalf := points[:mid]
	secondHalf := points[mid:]

	firstAvg := sumOf(firstHalf) / float64(len(firstHalf))
	secondAvg := sumOf(secondHalf) / float64(len(secondHalf))

	if firstAvg > 0 {
		rate := (secondAvg - firstAvg) / firstAvg * 100
		if rate > 10 {
			return "increasing"
		} else if rate < -10 {
			return "decreasing"
		}
	}
	return "stable"
}

func calculateChangeRate(points []models.CostTrendPoint) float64 {
	if len(points) < 2 {
		return 0
	}
	mid := len(points) / 2
	firstHalf := points[:mid]
	secondHalf := points[mid:]
	firstAvg := sumOf(firstHalf) / float64(len(firstHalf))
	secondAvg := sumOf(secondHalf) / float64(len(secondHalf))
	if firstAvg > 0 {
		return (secondAvg - firstAvg) / firstAvg * 100
	}
	return 0
}

func sumOf(points []models.CostTrendPoint) float64 {
	sum := 0.0
	for _, p := range points {
		sum += p.Cost
	}
	return sum
}

// CountCostRecords returns the total number of cost records for a tenant.
func (s *CostService) CountCostRecords(ctx context.Context, tenantID string) (int64, error) {
	return s.repo.CountCostRecords(ctx, tenantID)
}

// EvaluateCost evaluates a cost against the tenant's budget.
func (s *CostService) EvaluateCost(ctx context.Context, tenantID string, req *models.EvaluateCostRequest) (*models.EvaluateCostResult, error) {
	budgets, err := s.repo.ListBudgets(ctx, tenantID, 0, 100)
	if err != nil {
		return nil, err
	}

	budgetCents := 0
	thresholdPct := 80.0
	for _, b := range budgets {
		budgetCents += int(b.Amount * 100)
		if b.AlertThreshold > 0 {
			thresholdPct = b.AlertThreshold
		}
	}

	if budgetCents == 0 {
		return &models.EvaluateCostResult{
			IsWithinBudget:  true,
			ThresholdPercent: 100.0,
		}, nil
	}

	usedCents := int(req.Amount * 100)
	usagePercent := float64(usedCents) / float64(budgetCents) * 100

	// Estimate savings based on optimization suggestions
	opts, _ := s.repo.GetOptimizations(ctx, tenantID, "", "", 0, 20)
	estimatedSavings := 0.0
	for _, o := range opts {
		estimatedSavings += o.EstimatedSavings
	}

	return &models.EvaluateCostResult{
		BudgetCents:      budgetCents,
		UsedCents:        usedCents,
		RemainingCents:   budgetCents - usedCents,
		UsagePercent:     usagePercent,
		IsWithinBudget:   usagePercent <= 100,
		ExceedsThreshold: usagePercent >= thresholdPct,
		ThresholdPercent: thresholdPct,
		EstimatedSavings: estimatedSavings,
	}, nil
}

// GetCostOverview returns a high-level cost overview for the tenant.
func (s *CostService) GetCostOverview(ctx context.Context, tenantID string) (*models.CostOverview, error) {
	// Get current month and previous month totals
	currentMonth, err := s.repo.GetMonthlyCost(ctx, tenantID, "")
	if err != nil {
		return nil, err
	}
	prevMonth, err := s.repo.GetMonthlyCost(ctx, tenantID, "previous")
	if err != nil {
		return nil, err
	}

	var momChange float64
	if prevMonth > 0 {
		momChange = (currentMonth - prevMonth) / prevMonth * 100
	}

	// Project monthly cost (simple projection based on current month)
	projected := currentMonth

	// Budget info
	budgets, err := s.repo.ListBudgets(ctx, tenantID, 0, 100)
	if err != nil {
		return nil, err
	}
	var budgetTotal, budgetUsagePercent float64
	for _, b := range budgets {
		budgetTotal += b.Amount
		if b.Amount > 0 {
			budgetUsagePercent += b.CurrentSpend / b.Amount * 100
		}
	}
	if len(budgets) > 0 {
		budgetUsagePercent /= float64(len(budgets))
	}

	return &models.CostOverview{
		TotalCost:            currentMonth,
		CurrentMonthCost:     currentMonth,
		PreviousMonthCost:    prevMonth,
		MonthOverMonthChange: momChange,
		ProjectedMonthlyCost: projected,
		BudgetRemaining:      budgetTotal - currentMonth,
		BudgetTotal:          budgetTotal,
		BudgetUsagePercent:   budgetUsagePercent,
	}, nil
}

// CompareCosts compares costs between two services.
func (s *CostService) CompareCosts(ctx context.Context, tenantID string, req *models.CompareCostsRequest) (*models.ServiceCostComparison, error) {
	costA, err := s.repo.GetCostByServiceName(ctx, tenantID, req.ServiceA, req.Period)
	if err != nil {
		return nil, err
	}
	costB, err := s.repo.GetCostByServiceName(ctx, tenantID, req.ServiceB, req.Period)
	if err != nil {
		return nil, err
	}

	diff := costA - costB
	var pctDiff float64
	if costB > 0 {
		pctDiff = diff / costB * 100
	}
	higher := req.ServiceB
	if costA > costB {
		higher = req.ServiceA
	}

	return &models.ServiceCostComparison{
		ServiceA: req.ServiceA,
		ServiceB: req.ServiceB,
		Period:   req.Period,
		CostA:    costA,
		CostB:    costB,
		Diff:     diff,
		PctDiff:  pctDiff,
		Higher:   higher,
	}, nil
}

// GetServiceCostTrend returns the cost trend for a specific service.
func (s *CostService) GetServiceCostTrend(ctx context.Context, tenantID, serviceName, period, category string) (*models.CostTrendResult, error) {
	// For service-specific trend, use the general cost trend and filter by service
	points, err := s.repo.GetServiceCostTrend(ctx, tenantID, serviceName, category)
	if err != nil {
		return nil, err
	}

	if len(points) == 0 {
		return &models.CostTrendResult{
			Points:      points,
			TotalCost:   0,
			AverageCost: 0,
			Trend:       "stable",
			ChangeRate:  0,
		}, nil
	}

	totalCost := 0.0
	for _, p := range points {
		totalCost += p.Cost
	}
	averageCost := totalCost / float64(len(points))

	return &models.CostTrendResult{
		Points:      points,
		TotalCost:   roundFloat(totalCost),
		AverageCost: roundFloat(averageCost),
		Trend:       calculateTrend(points),
		ChangeRate:  calculateChangeRate(points),
	}, nil
}

// GetServiceOptimizationSuggestions returns optimization suggestions for a specific service.
func (s *CostService) GetServiceOptimizationSuggestions(ctx context.Context, tenantID, serviceName, entityType string) ([]models.OptimizationRecommendation, error) {
	params := models.GetOptimizationsQueryParams{
		Status: models.OptStatusIdentified,
	}
	suggestions, err := s.optSvc.ListSuggestions(ctx, tenantID, params)
	if err != nil {
		return nil, err
	}

	// Filter by service name if provided
	var filtered []models.OptimizationRecommendation
	for _, s := range suggestions {
		if serviceName == "default" || serviceName == "" {
			filtered = append(filtered, s)
		} else {
			// Match by resource ID or service reference in metadata
			if containsString(s.ResourceIDs, serviceName) {
				filtered = append(filtered, s)
			}
		}
	}
	return filtered, nil
}

func containsString(list []string, item string) bool {
	for _, v := range list {
		if v == item {
			return true
		}
	}
	return false
}
