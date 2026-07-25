package service

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/finops/finops/models"
	"orion/platform-svc-go/internal/finops/finops/repository"

	"github.com/google/uuid"
)

// BudgetService manages budgets, spend tracking, and forecasting.
type BudgetService struct {
	costRepo *repository.CostRepository
}

func NewBudgetService(costRepo *repository.CostRepository) *BudgetService {
	return &BudgetService{costRepo: costRepo}
}

// Create creates a new budget with optional alert thresholds.
func (s *BudgetService) Create(ctx context.Context, tenantID string, req models.CreateBudgetRequest) (*models.Budget, error) {
	budget := &models.Budget{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		EntityType:  req.EntityType,
		EntityID:    req.EntityID,
		Name:        req.Name,
		AmountCents: req.AmountCents,
		Currency:    req.Currency,
		Period:      req.Period,
		Environment: req.Environment,
		Description: req.Description,
		Status:      "active",
	}
	if budget.Currency == "" {
		budget.Currency = "USD"
	}
	if budget.Period == "" {
		budget.Period = models.CostPeriodMonthly
	}

	var thresholds []int
	for _, a := range req.Alerts {
		thresholds = append(thresholds, a.Percentage)
	}
	if len(thresholds) == 0 {
		thresholds = []int{50, 75, 90} // default thresholds
	}

	if err := s.costRepo.CreateBudget(ctx, budget, thresholds); err != nil {
		return nil, fmt.Errorf("create budget: %w", err)
	}
	return budget, nil
}

// Get returns a budget by ID.
func (s *BudgetService) Get(ctx context.Context, tenantID, id string) (*models.Budget, error) {
	return s.costRepo.GetBudget(ctx, tenantID, id)
}

// List returns budgets for a tenant.
func (s *BudgetService) List(ctx context.Context, tenantID string, offset, limit int) ([]models.Budget, error) {
	return s.costRepo.ListBudgets(ctx, tenantID, offset, limit)
}

// Update updates a budget.
func (s *BudgetService) Update(ctx context.Context, tenantID, id string, req models.UpdateBudgetRequest) (*models.Budget, error) {
	budget, err := s.costRepo.GetBudget(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("budget not found: %w", err)
	}

	if req.AmountCents != nil {
		budget.AmountCents = *req.AmountCents
	}
	if req.Period != nil {
		budget.Period = *req.Period
	}
	if req.Environment != nil {
		budget.Environment = *req.Environment
	}
	if req.Description != nil {
		budget.Description = *req.Description
	}

	if err := s.costRepo.UpdateBudget(ctx, budget); err != nil {
		return nil, err
	}
	return budget, nil
}

// Delete soft-deletes a budget.
func (s *BudgetService) Delete(ctx context.Context, tenantID, id string) error {
	return s.costRepo.DeleteBudget(ctx, tenantID, id)
}

// RecordSpend records a spend against a budget and checks thresholds.
func (s *BudgetService) RecordSpend(ctx context.Context, tenantID, budgetID string, amountCents int64) error {
	budget, err := s.costRepo.GetBudget(ctx, tenantID, budgetID)
	if err != nil {
		return fmt.Errorf("budget not found: %w", err)
	}

	if err := s.costRepo.RecordBudgetSpend(ctx, budgetID, amountCents); err != nil {
		return err
	}

	// Check thresholds
	totalSpend, err := s.costRepo.GetTotalBudgetSpend(ctx, budgetID)
	if err != nil {
		return err
	}

	usagePct := float64(totalSpend) / float64(budget.AmountCents) * 100

	thresholds, err := s.costRepo.GetBudgetThresholds(ctx, budgetID)
	if err != nil {
		return err
	}

	for _, t := range thresholds {
		if !t.Triggered && usagePct >= float64(t.Percentage) {
			// Trigger alert
			_ = s.costRepo.UpdateBudgetThreshold(ctx, t.ID, true)
			_ = s.costRepo.InsertBudgetAlertTrigger(ctx, &models.BudgetAlertTrigger{
				ID:           uuid.New().String(),
				BudgetID:     budgetID,
				ThresholdPct: t.Percentage,
				ActualCents:  totalSpend,
				UsagePct:     usagePct,
				EntityType:   string(budget.EntityType),
				EntityID:     budget.EntityID,
			})
		}
	}

	return nil
}

// GetStatus returns the current status of a budget including spend and forecast.
func (s *BudgetService) GetStatus(ctx context.Context, tenantID, budgetID string) (*models.BudgetStatus, error) {
	budget, err := s.costRepo.GetBudget(ctx, tenantID, budgetID)
	if err != nil {
		return nil, fmt.Errorf("budget not found: %w", err)
	}

	totalSpend, err := s.costRepo.GetTotalBudgetSpend(ctx, budgetID)
	if err != nil {
		return nil, err
	}

	triggers, err := s.costRepo.GetBudgetAlertTriggers(ctx, budgetID)
	if err != nil {
		return nil, err
	}

	usagePct := float64(0)
	if budget.AmountCents > 0 {
		usagePct = float64(totalSpend) / float64(budget.AmountCents) * 100
	}

	remaining := budget.AmountCents - totalSpend
	if remaining < 0 {
		remaining = 0
	}

	status := &models.BudgetStatus{
		BudgetID:          budgetID,
		EntityType:        budget.EntityType,
		EntityID:          budget.EntityID,
		BudgetAmountCents: budget.AmountCents,
		CurrentSpendCents: totalSpend,
		UsagePercent:      usagePct,
		RemainingCents:    remaining,
		Period:            budget.Period,
		OverBudget:        totalSpend > budget.AmountCents,
		TriggeredAlerts:   triggers,
	}

	// Generate forecast
	forecast := s.forecastSpend(ctx, budgetID, totalSpend, budget)
	if forecast != nil {
		status.ForecastedSpendCents = &forecast.ForecastedSpendCents
	}

	return status, nil
}

// GetForecast returns a spending forecast for a budget.
func (s *BudgetService) GetForecast(ctx context.Context, tenantID, budgetID string) (*models.BudgetForecast, error) {
	budget, err := s.costRepo.GetBudget(ctx, tenantID, budgetID)
	if err != nil {
		return nil, fmt.Errorf("budget not found: %w", err)
	}

	totalSpend, err := s.costRepo.GetTotalBudgetSpend(ctx, budgetID)
	if err != nil {
		return nil, err
	}

	forecast := s.forecastSpend(ctx, budgetID, totalSpend, budget)
	if forecast == nil {
		return &models.BudgetForecast{
			BudgetID:             budgetID,
			CurrentSpendCents:    totalSpend,
			ForecastedSpendCents: totalSpend,
			WithinBudget:         totalSpend <= budget.AmountCents,
		}, nil
	}

	return forecast, nil
}

// forecastSpend generates a simple linear forecast.
func (s *BudgetService) forecastSpend(ctx context.Context, budgetID string, totalSpend int64, budget *models.Budget) *models.BudgetForecast {
	spends, err := s.costRepo.GetBudgetSpendHistory(ctx, budgetID)
	if err != nil || len(spends) < 2 {
		return nil
	}

	// Calculate daily spend rate from history
	firstSpend := spends[0].RecordedAt
	lastSpend := spends[len(spends)-1].RecordedAt
	days := lastSpend.Sub(firstSpend).Hours() / 24
	if days < 1 {
		days = 1
	}

	dailyRate := float64(totalSpend) / days

	// Determine remaining days in period
	var remainingDays float64
	switch budget.Period {
	case models.CostPeriodMonthly:
		remainingDays = 30 - days
	case models.CostPeriodWeekly:
		remainingDays = 7 - days
	case models.CostPeriodQuarterly:
		remainingDays = 90 - days
	case models.CostPeriodYearly:
		remainingDays = 365 - days
	default:
		remainingDays = 30 - days
	}
	if remainingDays < 0 {
		remainingDays = 0
	}

	forecasted := totalSpend + int64(dailyRate*remainingDays)
	projectedOverage := forecasted - budget.AmountCents
	if projectedOverage < 0 {
		projectedOverage = 0
	}

	daysUntilExhausted := 0
	if dailyRate > 0 && totalSpend < budget.AmountCents {
		daysUntilExhausted = int(float64(budget.AmountCents-totalSpend) / (dailyRate * 86400))
	}

	return &models.BudgetForecast{
		BudgetID:              budgetID,
		CurrentSpendCents:     totalSpend,
		ForecastedSpendCents:  forecasted,
		ProjectedOverageCents: projectedOverage,
		DailySpendRateCents:   dailyRate,
		DaysUntilExhausted:    daysUntilExhausted,
		WithinBudget:          forecasted <= budget.AmountCents,
	}
}

// GetAlertTriggers returns alert triggers for a budget.
func (s *BudgetService) GetAlertTriggers(ctx context.Context, budgetID string) ([]models.BudgetAlertTrigger, error) {
	return s.costRepo.GetBudgetAlertTriggers(ctx, budgetID)
}

// GetAllAlertTriggers returns all alert triggers for a tenant.
func (s *BudgetService) GetAllAlertTriggers(ctx context.Context, tenantID string) ([]models.BudgetAlertTrigger, error) {
	return s.costRepo.GetAllBudgetAlertTriggers(ctx, tenantID)
}

// CheckThresholds checks all budgets for threshold breaches.
func (s *BudgetService) CheckThresholds(ctx context.Context, tenantID string) ([]models.BudgetAlertTrigger, error) {
	budgets, err := s.costRepo.ListBudgets(ctx, tenantID, 0, 1000)
	if err != nil {
		return nil, err
	}

	var newTriggers []models.BudgetAlertTrigger
	for _, budget := range budgets {
		totalSpend, err := s.costRepo.GetTotalBudgetSpend(ctx, budget.ID)
		if err != nil {
			continue
		}

		if budget.AmountCents <= 0 {
			continue
		}

		usagePct := float64(totalSpend) / float64(budget.AmountCents) * 100
		thresholds, err := s.costRepo.GetBudgetThresholds(ctx, budget.ID)
		if err != nil {
			continue
		}

		for _, t := range thresholds {
			if !t.Triggered && usagePct >= float64(t.Percentage) {
				_ = s.costRepo.UpdateBudgetThreshold(ctx, t.ID, true)
				trigger := models.BudgetAlertTrigger{
					ID:           uuid.New().String(),
					BudgetID:     budget.ID,
					ThresholdPct: t.Percentage,
					ActualCents:  totalSpend,
					UsagePct:     usagePct,
					EntityType:   string(budget.EntityType),
					EntityID:     budget.EntityID,
					TriggeredAt:  time.Now(),
				}
				_ = s.costRepo.InsertBudgetAlertTrigger(ctx, &trigger)
				newTriggers = append(newTriggers, trigger)
			}
		}
	}

	return newTriggers, nil
}
