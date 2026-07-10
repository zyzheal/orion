package service

import (
	"context"
	"errors"
	"time"

	"orion/cost-svc-go/internal/models"
	"orion/cost-svc-go/internal/repository"

	"go.uber.org/zap"
)

var (
	ErrInvalidTenantID = errors.New("tenant ID required")
	ErrNotFound        = errors.New("record not found")
)

// CostService handles cost aggregation and querying by resource, time, and tenant.
type CostService struct {
	repo   *repository.CostRepository
	logger *zap.Logger
}

// NewCostService creates a new cost service instance.
func NewCostService(repo *repository.CostRepository, logger *zap.Logger) *CostService {
	return &CostService{repo: repo, logger: logger}
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
