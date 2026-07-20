package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/finops/models"

	"github.com/google/uuid"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CreateBudgetGuard(ctx context.Context, guard *models.BudgetGuard) error
	DeleteBudgetGuard(ctx context.Context, id string, tenantID string) (bool, error)
	GetBudgetGuard(ctx context.Context, id string, tenantID string) (*models.BudgetGuard, error)
	GetCostByService(ctx context.Context, tenantID string, service string) (*models.CostItem, error)
	GetCostTrend(ctx context.Context, tenantID string, days int) ([]models.TrendPoint, error)
	ListAnomalies(ctx context.Context, tenantID string, severity *string, timeWindow *models.TimeWindow) ([]models.Anomaly, error)
	ListBudgetGuards(ctx context.Context, tenantID string) ([]models.BudgetGuard, error)
	ListCostItems(ctx context.Context, tenantID string, service *string) ([]models.CostItem, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// --- Budget Guards ---

func (s *Service) ListBudgetGuards(ctx context.Context, tenantID string) ([]models.BudgetGuard, error) {
	guards, err := s.repo.ListBudgetGuards(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	if guards == nil {
		guards = []models.BudgetGuard{}
	}
	return guards, nil
}

func (s *Service) GetBudgetGuard(ctx context.Context, id string, tenantID string) (*models.BudgetGuard, error) {
	guard, err := s.repo.GetBudgetGuard(ctx, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrGuardNotFound
		}
		return nil, err
	}
	return guard, nil
}

func (s *Service) CreateBudgetGuard(ctx context.Context, req *models.CreateBudgetGuardRequest, tenantID string) (*models.BudgetGuard, error) {
	guard := &models.BudgetGuard{
		TenantID:     tenantID,
		Name:         req.Name,
		Description:  req.Description,
		BudgetAmount: req.BudgetAmount,
		ThresholdPct: req.ThresholdPct,
		Action:       req.Action,
		Scope:        req.Scope,
	}
	if req.Currency != nil && *req.Currency != "" {
		guard.Currency = *req.Currency
	} else {
		guard.Currency = "USD"
	}
	guard.Enabled = true
	if err := s.repo.CreateBudgetGuard(ctx, guard); err != nil {
		return nil, err
	}
	return s.repo.GetBudgetGuard(ctx, guard.ID, tenantID)
}

func (s *Service) DeleteBudgetGuard(ctx context.Context, id string, tenantID string) (bool, error) {
	return s.repo.DeleteBudgetGuard(ctx, id, tenantID)
}

// --- Evaluate Cost ---

func (s *Service) EvaluateCost(ctx context.Context, tenantID string, pipelineID string, estimatedCost float64, projectID *string, environment *string) (*models.EvaluationResult, error) {
	guards, err := s.repo.ListBudgetGuards(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	// Find the first matching guard for the pipeline/project
	var matched *models.BudgetGuard
	for _, g := range guards {
		if g.Scope != nil {
			if *g.Scope == pipelineID || (projectID != nil && *g.Scope == *projectID) {
				matched = &g
				break
			}
		} else {
			matched = &g
			break
		}
	}

	if matched == nil {
		return &models.EvaluationResult{
			Passed:        true,
			EstimatedCost: estimatedCost,
			Message:       "no budget guard found, allowing",
			TenantID:      tenantID,
			ProjectID:     projectID,
			Environment:   environment,
		}, nil
	}

	threshold := 100.0
	if matched.ThresholdPct != nil {
		threshold = *matched.ThresholdPct
	}
	budget := matched.BudgetAmount
	passed := true
	if budget != nil {
		usage := (estimatedCost / *budget) * 100
		passed = usage <= threshold
	}

	result := &models.EvaluationResult{
		Passed:        passed,
		EstimatedCost: estimatedCost,
		TenantID:      tenantID,
		ProjectID:     projectID,
		Environment:   environment,
	}
	if matched.BudgetAmount != nil {
		result.BudgetAmount = matched.BudgetAmount
		result.ThresholdPct = matched.ThresholdPct
	}

	msg := fmt.Sprintf("cost %.2f within budget threshold %.2f%%", estimatedCost, threshold)
	if !passed {
		msg = fmt.Sprintf("cost %.2f exceeds budget threshold %.2f%%", estimatedCost, threshold)
	}
	result.Message = msg

	return result, nil
}

// --- Anomaly Detection ---

func (s *Service) DetectAnomalies(ctx context.Context, tenantID string, days *int, startStr *string, endStr *string) (*models.AnomalyDetectionResult, error) {
	var tw *models.TimeWindow
	if startStr != nil && endStr != nil {
		start, err := time.Parse(time.RFC3339, *startStr)
		if err == nil {
			end, err2 := time.Parse(time.RFC3339, *endStr)
			if err2 == nil {
				tw = &models.TimeWindow{Start: start, End: end}
			}
		}
	}
	if tw == nil {
		d := 30
		if days != nil && *days > 0 {
			d = *days
		}
		tw = &models.TimeWindow{
			Start: time.Now().UTC().Add(-time.Duration(d) * 24 * time.Hour),
			End:   time.Now().UTC(),
		}
	}

	anomalies, err := s.repo.ListAnomalies(ctx, tenantID, nil, tw)
	if err != nil {
		return nil, err
	}
	if anomalies == nil {
		anomalies = []models.Anomaly{}
	}

	return &models.AnomalyDetectionResult{
		Anomalies:  anomalies,
		Count:      len(anomalies),
		TimeWindow: *tw,
	}, nil
}

// --- Cost Trend ---

func (s *Service) GetCostTrend(ctx context.Context, tenantID string, days int) (*models.CostTrendResult, error) {
	if days <= 0 {
		days = 30
	}
	points, err := s.repo.GetCostTrend(ctx, tenantID, days)
	if err != nil {
		return nil, err
	}
	if points == nil {
		points = []models.TrendPoint{}
	}
	return &models.CostTrendResult{
		Points:   points,
		Days:     days,
		TenantID: tenantID,
	}, nil
}

// --- Cost Overview ---

func (s *Service) GetCostOverview(ctx context.Context, tenantID string) (*models.CostOverview, error) {
	// Return a placeholder overview
	return &models.CostOverview{
		TotalCost:            0,
		CurrentMonthCost:     0,
		PreviousMonthCost:    0,
		MonthOverMonthChange: 0,
		ProjectedMonthlyCost: 0,
		BudgetRemaining:      0,
		BudgetTotal:          0,
		BudgetUsagePercent:   0,
	}, nil
}

// --- Optimization Suggestions ---

func (s *Service) GetOptimizationSuggestions(ctx context.Context, tenantID string, category *string, minSavings *float64) ([]models.OptimizationSuggestion, error) {
	// Generate synthetic optimization suggestions based on cost items
	costItems, err := s.repo.ListCostItems(ctx, tenantID, nil)
	if err != nil {
		return nil, err
	}
	if len(costItems) == 0 {
		return []models.OptimizationSuggestion{}, nil
	}

	suggestions := []models.OptimizationSuggestion{}
	for _, ci := range costItems {
		if ci.Cost <= 0 {
			continue
		}
		sav := ci.Cost * 0.15
		if minSavings != nil && sav < *minSavings {
			continue
		}
		if category != nil && *category != "" && *category != "right-sizing" {
			continue
		}
		suggestions = append(suggestions, models.OptimizationSuggestion{
			ID:               uuid.New().String(),
			TenantID:         tenantID,
			Service:          ci.Service,
			Category:         "right-sizing",
			Description:      fmt.Sprintf("Right-size service %s to save ~%.2f", ci.Service, sav),
			PotentialSavings: sav,
			Status:           "open",
			CreatedAt:        time.Now().UTC(),
		})
	}
	return suggestions, nil
}

func (s *Service) ApplyOptimization(ctx context.Context, tenantID string, id string) (bool, error) {
	// In a real implementation, this would apply the optimization
	// For now, return true to acknowledge the request
	return true, nil
}

func (s *Service) RejectOptimization(ctx context.Context, tenantID string, id string) (bool, error) {
	return true, nil
}

// --- Cost Comparison ---

func (s *Service) CompareCosts(ctx context.Context, tenantID string, serviceA string, serviceB string, period string) (*models.CostComparisonResult, error) {
	itemA, err := s.repo.GetCostByService(ctx, tenantID, serviceA)
	costA := 0.0
	if err == nil && itemA != nil {
		costA = itemA.Cost
	}

	itemB, err := s.repo.GetCostByService(ctx, tenantID, serviceB)
	costB := 0.0
	if err == nil && itemB != nil {
		costB = itemB.Cost
	}

	difference := costA - costB
	var percentage float64
	if costB > 0 {
		percentage = (difference / costB) * 100
	}
	cheaper := "A"
	if costB < costA {
		cheaper = "B"
	} else if costA == costB {
		cheaper = "equal"
	}

	return &models.CostComparisonResult{
		ServiceA:   serviceA,
		ServiceB:   serviceB,
		CostA:      costA,
		CostB:      costB,
		Difference: difference,
		Percentage: percentage,
		Cheaper:    cheaper,
		Period:     period,
	}, nil
}

// --- Service Cost Trend ---

func (s *Service) GetServiceCostTrend(ctx context.Context, tenantID string, serviceID string, period string) (*models.CostTrendResult, error) {
	return s.GetCostTrend(ctx, tenantID, 30)
}

// --- Service Optimization Suggestions ---

func (s *Service) GetServiceOptimizationSuggestions(ctx context.Context, tenantID string, serviceID string, entityType string) ([]models.OptimizationSuggestion, error) {
	items, err := s.repo.ListCostItems(ctx, tenantID, &serviceID)
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return []models.OptimizationSuggestion{}, nil
	}

	suggestions := []models.OptimizationSuggestion{}
	for _, ci := range items {
		sav := ci.Cost * 0.1
		suggestions = append(suggestions, models.OptimizationSuggestion{
			ID:               uuid.New().String(),
			TenantID:         tenantID,
			Service:          ci.Service,
			Category:         entityType,
			Description:      fmt.Sprintf("Optimize %s (%s) to save ~%.2f", ci.Service, ci.Currency, sav),
			PotentialSavings: sav,
			Status:           "open",
			CreatedAt:        time.Now().UTC(),
		})
	}
	return suggestions, nil
}

// --- Errors ---

var (
	ErrGuardNotFound = errors.New("budget guard not found")
)

func IsNotFound(err error) bool {
	return errors.Is(err, ErrGuardNotFound)
}
