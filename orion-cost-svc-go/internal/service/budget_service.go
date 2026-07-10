package service

import (
	"context"
	"errors"

	"orion/cost-svc-go/internal/models"
	"orion/cost-svc-go/internal/repository"

	"go.uber.org/zap"
)

var (
	ErrBudgetNotFound = errors.New("budget not found")
	ErrInvalidAmount  = errors.New("budget amount must be positive")
)

// BudgetService handles budget creation, tracking, and threshold alerts.
type BudgetService struct {
	repo   *repository.CostRepository
	logger *zap.Logger
}

// NewBudgetService creates a new budget service instance.
func NewBudgetService(repo *repository.CostRepository, logger *zap.Logger) *BudgetService {
	return &BudgetService{repo: repo, logger: logger}
}

// CreateBudget creates a new budget for a tenant.
func (s *BudgetService) CreateBudget(ctx context.Context, tenantID string, req *models.CreateBudgetRequest) (*models.Budget, error) {
	if req.Amount <= 0 {
		return nil, ErrInvalidAmount
	}

	budget := &models.Budget{
		TenantID:       tenantID,
		Name:           req.Name,
		Amount:         req.Amount,
		Period:         req.Period,
		AlertThreshold: req.AlertThreshold,
		CurrentSpend:   0,
	}
	if budget.Period == "" {
		budget.Period = models.BudgetPeriodMonthly
	}

	if err := s.repo.CreateBudget(ctx, budget); err != nil {
		s.logger.Error("failed to create budget", zap.Error(err))
		return nil, err
	}

	s.logger.Info("budget created", zap.String("tenant_id", tenantID), zap.String("name", req.Name))
	return budget, nil
}

// GetBudget retrieves a budget by ID.
func (s *BudgetService) GetBudget(ctx context.Context, tenantID, id string) (*models.Budget, error) {
	budget, err := s.repo.GetBudget(ctx, tenantID, id)
	if err != nil {
		return nil, ErrBudgetNotFound
	}
	return budget, nil
}

// ListBudgets lists budgets for a tenant.
func (s *BudgetService) ListBudgets(ctx context.Context, tenantID string, offset, limit int) ([]models.Budget, error) {
	return s.repo.ListBudgets(ctx, tenantID, offset, limit)
}

// UpdateBudget updates an existing budget.
func (s *BudgetService) UpdateBudget(ctx context.Context, tenantID, id string, req *models.UpdateBudgetRequest) (*models.Budget, error) {
	budget, err := s.repo.GetBudget(ctx, tenantID, id)
	if err != nil {
		return nil, ErrBudgetNotFound
	}

	if req.Name != nil {
		budget.Name = *req.Name
	}
	if req.Amount != nil && *req.Amount > 0 {
		budget.Amount = *req.Amount
	}
	if req.Period != nil {
		budget.Period = *req.Period
	}
	if req.AlertThreshold != nil {
		budget.AlertThreshold = *req.AlertThreshold
	}

	if err := s.repo.UpdateBudget(ctx, budget); err != nil {
		s.logger.Error("failed to update budget", zap.Error(err))
		return nil, err
	}

	s.logger.Info("budget updated", zap.String("budget_id", id))
	return budget, nil
}

// GetBudgetAlerts returns budgets that have breached their alert threshold.
func (s *BudgetService) GetBudgetAlerts(ctx context.Context, tenantID string) ([]models.Budget, error) {
	return s.repo.GetBudgetAlerts(ctx, tenantID)
}

// CheckBudgetHealth evaluates the health status of a budget.
func (s *BudgetService) CheckBudgetHealth(ctx context.Context, tenantID, id string) (*models.BudgetHealth, error) {
	budget, err := s.repo.GetBudget(ctx, tenantID, id)
	if err != nil {
		return nil, ErrBudgetNotFound
	}

	usagePercent := 0.0
	remaining := budget.Amount
	if budget.Amount > 0 {
		usagePercent = budget.CurrentSpend / budget.Amount * 100
		remaining = budget.Amount - budget.CurrentSpend
	}

	status := "ok"
	if usagePercent >= 100 {
		status = "exceeded"
	} else if usagePercent >= budget.AlertThreshold {
		status = "critical"
	} else if usagePercent >= budget.AlertThreshold*0.8 {
		status = "warning"
	}

	return &models.BudgetHealth{
		Budget:       budget,
		UsagePercent: roundFloat(usagePercent),
		Status:       status,
		Remaining:    roundFloat(remaining),
	}, nil
}

