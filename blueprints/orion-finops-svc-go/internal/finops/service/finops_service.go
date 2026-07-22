package service

import (
	"context"
	"errors"

	"orion/finops-svc-go/internal/finops/models"
	"orion/finops-svc-go/internal/finops/repository"

	"github.com/google/uuid"
)

var (
	ErrBudgetAlertNotFound = errors.New("budget alert not found")
	ErrInvalidThreshold    = errors.New("invalid threshold percentage")
)

// FinOpsService provides cost management business logic.
type FinOpsService struct {
	costRepo *repository.CostRepository
}

func NewFinOpsService(costRepo *repository.CostRepository) *FinOpsService {
	return &FinOpsService{costRepo: costRepo}
}

func (s *FinOpsService) RecordCloudCost(ctx context.Context, tenantID string, req *models.RecordCostRequest) error {
	cost := &models.CloudCost{
		ID:           uuid.New().String(),
		TenantID:     tenantID,
		ResourceType: req.ResourceType,
		ResourceID:   req.ResourceID,
		Provider:     req.Provider,
		Region:       req.Region,
		Service:      req.Service,
		CostCents:    req.CostCents,
		Currency:     req.Currency,
		PeriodStart:  req.PeriodStart,
		PeriodEnd:    req.PeriodEnd,
		Tags:         models.JSONB(req.Tags),
	}
	if cost.Currency == "" {
		cost.Currency = "USD"
	}
	return s.costRepo.CreateCloudCost(ctx, cost)
}

func (s *FinOpsService) RecordK8sCost(ctx context.Context, tenantID string, cost *models.K8sCost) error {
	cost.ID = uuid.New().String()
	cost.TenantID = tenantID
	if cost.Currency == "" {
		cost.Currency = "USD"
	}
	cost.TotalCostCents = cost.CPUCostCents + cost.MemCostCents + cost.StorageCostCents
	return s.costRepo.CreateK8sCost(ctx, cost)
}

func (s *FinOpsService) RecordSaaSCost(ctx context.Context, tenantID string, cost *models.SaaSCost) error {
	cost.ID = uuid.New().String()
	cost.TenantID = tenantID
	if cost.Currency == "" {
		cost.Currency = "USD"
	}
	return s.costRepo.CreateSaaSCost(ctx, cost)
}

func (s *FinOpsService) GetCostSummary(ctx context.Context, tenantID, periodStart, periodEnd string) (*models.CostSummary, error) {
	return s.costRepo.GetCostSummary(ctx, tenantID, periodStart, periodEnd)
}

func (s *FinOpsService) CreateBudgetAlert(ctx context.Context, tenantID string, req *models.CreateBudgetAlertRequest) (*models.BudgetAlert, error) {
	if req.ThresholdPct < 1 || req.ThresholdPct > 100 {
		return nil, ErrInvalidThreshold
	}

	alert := &models.BudgetAlert{
		ID:           uuid.New().String(),
		TenantID:     tenantID,
		Name:         req.Name,
		BudgetCents:  req.BudgetCents,
		ThresholdPct: req.ThresholdPct,
		Status:       models.AlertActive,
		NotifyEmail:  req.NotifyEmail,
		Period:       req.Period,
	}
	if alert.Period == "" {
		alert.Period = models.CostPeriodMonthly
	}

	if err := s.costRepo.CreateBudgetAlert(ctx, alert); err != nil {
		return nil, err
	}
	return alert, nil
}

func (s *FinOpsService) ListBudgetAlerts(ctx context.Context, tenantID string, offset, limit int) ([]models.BudgetAlert, error) {
	return s.costRepo.ListBudgetAlerts(ctx, tenantID, offset, limit)
}

func (s *FinOpsService) UpdateBudgetAlert(ctx context.Context, tenantID, id string, req *models.CreateBudgetAlertRequest) (*models.BudgetAlert, error) {
	alert, err := s.costRepo.GetBudgetAlertByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrBudgetAlertNotFound
	}

	alert.Name = req.Name
	alert.BudgetCents = req.BudgetCents
	alert.ThresholdPct = req.ThresholdPct
	alert.NotifyEmail = req.NotifyEmail
	if req.Period != "" {
		alert.Period = req.Period
	}

	if err := s.costRepo.UpdateBudgetAlert(ctx, alert); err != nil {
		return nil, err
	}
	return alert, nil
}

func (s *FinOpsService) Delete(ctx context.Context, tenantID, id string) error {
	return s.costRepo.Delete(ctx, tenantID, id)
}

func (s *FinOpsService) Count(ctx context.Context, tenantID string) (int, error) {
	return s.costRepo.Count(ctx, tenantID)
}
