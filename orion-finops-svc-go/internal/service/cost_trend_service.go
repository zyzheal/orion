package service

import (
	"context"
	"fmt"
	"math"

	"orion/finops-svc-go/internal/models"
	"orion/finops-svc-go/internal/repository"
)

// CostTrendService provides cost trend analysis and anomaly detection.
type CostTrendService struct {
	costRepo *repository.CostRepository
}

func NewCostTrendService(costRepo *repository.CostRepository) *CostTrendService {
	return &CostTrendService{costRepo: costRepo}
}

// GetCostTrend returns cost trend data with change rates.
func (s *CostTrendService) GetCostTrend(ctx context.Context, tenantID, periodStart, periodEnd string) (*models.CostTrend, error) {
	points, err := s.costRepo.GetCostTrend(ctx, tenantID, periodStart, periodEnd)
	if err != nil {
		return nil, err
	}

	if len(points) == 0 {
		return &models.CostTrend{
			Period: models.CostPeriodDaily,
			Points: []models.CostTrendPoint{},
		}, nil
	}

	// Calculate statistics
	var totalCents int64
	var maxCents, minCents int64
	minCents = points[0].CostCents

	for _, p := range points {
		totalCents += p.CostCents
		if p.CostCents > maxCents {
			maxCents = p.CostCents
		}
		if p.CostCents < minCents {
			minCents = p.CostCents
		}
	}

	avgCents := totalCents / int64(len(points))

	// Overall change rate (first to last)
	var overallChange float64
	if points[0].CostCents > 0 {
		overallChange = float64(points[len(points)-1].CostCents-points[0].CostCents) / float64(points[0].CostCents) * 100
	}

	return &models.CostTrend{
		Period:            models.CostPeriodDaily,
		Points:            points,
		OverallChangeRate: overallChange,
		AverageCostCents:  avgCents,
		MaxCostCents:      maxCents,
		MinCostCents:      minCents,
	}, nil
}

// GetCostByService returns cost breakdown by cloud service.
func (s *CostTrendService) GetCostByService(ctx context.Context, tenantID, periodStart, periodEnd string) ([]models.CostByService, error) {
	return s.costRepo.GetCostByService(ctx, tenantID, periodStart, periodEnd)
}

// GetK8sCostByNamespace returns K8s cost breakdown by namespace.
func (s *CostTrendService) GetK8sCostByNamespace(ctx context.Context, tenantID, periodStart, periodEnd string) ([]models.CostByService, error) {
	return s.costRepo.GetK8sCostsByNamespace(ctx, tenantID, periodStart, periodEnd)
}

// Anomaly represents a detected cost anomaly.
type Anomaly struct {
	Date          string  `json:"date"`
	CostCents     int64   `json:"cost_cents"`
	ExpectedCents int64   `json:"expected_cents"`
	Deviation     float64 `json:"deviation_pct"`
	Severity      string  `json:"severity"` // warning, critical
}

// DetectAnomalies detects cost anomalies using statistical analysis.
func (s *CostTrendService) DetectAnomalies(ctx context.Context, tenantID, periodStart, periodEnd string) ([]Anomaly, error) {
	points, err := s.costRepo.GetCostTrend(ctx, tenantID, periodStart, periodEnd)
	if err != nil {
		return nil, err
	}

	if len(points) < 7 {
		return []Anomaly{}, nil // need at least a week of data
	}

	// Calculate mean and std deviation
	var sum, sumSq float64
	for _, p := range points {
		sum += float64(p.CostCents)
		sumSq += float64(p.CostCents) * float64(p.CostCents)
	}

	n := float64(len(points))
	mean := sum / n
	variance := (sumSq / n) - (mean * mean)
	stdDev := math.Sqrt(math.Abs(variance))

	// Detect anomalies (>2 std deviations = warning, >3 = critical)
	var anomalies []Anomaly
	for _, p := range points {
		cost := float64(p.CostCents)
		deviation := math.Abs(cost-mean) / stdDev * 100

		if deviation > 300 { // >3 sigma
			anomalies = append(anomalies, Anomaly{
				Date:          p.Date,
				CostCents:     p.CostCents,
				ExpectedCents: int64(mean),
				Deviation:     deviation,
				Severity:      "critical",
			})
		} else if deviation > 200 { // >2 sigma
			anomalies = append(anomalies, Anomaly{
				Date:          p.Date,
				CostCents:     p.CostCents,
				ExpectedCents: int64(mean),
				Deviation:     deviation,
				Severity:      "warning",
			})
		}
	}

	return anomalies, nil
}

// ROIData represents return on investment analysis.
type ROIData struct {
	TotalInvestmentCents int64   `json:"total_investment_cents"`
	TotalSavingsCents    int64   `json:"total_savings_cents"`
	NetROICents          int64   `json:"net_roi_cents"`
	ROIPercentage        float64 `json:"roi_percentage"`
	OptimizationCount    int     `json:"optimization_count"`
	ImplementedCount     int     `json:"implemented_count"`
}

// CalculateROI calculates the ROI of implemented optimizations.
func (s *CostTrendService) CalculateROI(ctx context.Context, tenantID string) (*ROIData, error) {
	// Get all optimizations
	allOpts, err := s.costRepo.GetOptimizations(ctx, tenantID, "", "")
	if err != nil {
		return nil, fmt.Errorf("get optimizations: %w", err)
	}

	completedOpts, err := s.costRepo.GetOptimizations(ctx, tenantID, "", models.OptStatusCompleted)
	if err != nil {
		return nil, fmt.Errorf("get completed optimizations: %w", err)
	}

	var totalSavings int64
	for _, o := range completedOpts {
		totalSavings += o.EstimatedSavingsCents
	}

	// Estimate implementation cost (effort * hourly rate * 100 cents)
	var implCost int64
	for _, o := range completedOpts {
		implCost += int64(o.Effort) * 5000 // $50/hour * effort units
	}

	netROI := totalSavings - implCost
	var roiPct float64
	if implCost > 0 {
		roiPct = float64(netROI) / float64(implCost) * 100
	}

	return &ROIData{
		TotalInvestmentCents: implCost,
		TotalSavingsCents:    totalSavings,
		NetROICents:          netROI,
		ROIPercentage:        roiPct,
		OptimizationCount:    len(allOpts),
		ImplementedCount:     len(completedOpts),
	}, nil
}
