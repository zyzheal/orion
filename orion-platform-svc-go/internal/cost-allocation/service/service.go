package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/cost-allocation/models"
	"orion/platform-svc-go/internal/cost-allocation/repository"
	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CreateAllocation(ctx context.Context, a *models.Allocation) error
	CreateReport(ctx context.Context, report *models.Report) error
	CreateRule(ctx context.Context, rule *models.Rule) error
	DeleteAllocation(ctx context.Context, tenantID, id string) (bool, error)
	DeleteReport(ctx context.Context, tenantID, id string) (bool, error)
	DeleteRule(ctx context.Context, tenantID, ruleID string) (bool, error)
	GetAllocationByID(ctx context.Context, tenantID, id string) (*models.Allocation, error)
	GetReportByID(ctx context.Context, tenantID, id string) (*models.Report, error)
	ListAllocations(ctx context.Context, tenantID string, filter *models.AllocationFilter) ([]models.Allocation, error)
	ListReports(ctx context.Context, tenantID string, filter *models.ReportFilter) ([]models.Report, error)
	ListRulesByAllocation(ctx context.Context, tenantID, allocationID string) ([]models.Rule, error)
	UpdateAllocation(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Allocation, error)
	UpdateReport(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Report, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func (s *Service) CreateAllocation(ctx context.Context, tenantID string, req models.CreateAllocationRequest) (*models.Allocation, error) {
	a := &models.Allocation{
		TenantID:        tenantID,
		Name:            req.Name,
		Description:     req.Description,
		Type:            req.Type,
		Status:          "draft",
		SourceAccount:   req.SourceAccount,
		AllocationKey:   req.AllocationKey,
		AllocationRules: req.AllocationRules,
	}
	if err := s.repo.CreateAllocation(ctx, a); err != nil {
		return nil, err
	}
	return a, nil
}

func (s *Service) GetAllocation(ctx context.Context, tenantID, id string) (*models.Allocation, error) {
	return s.repo.GetAllocationByID(ctx, tenantID, id)
}

func (s *Service) ListAllocations(ctx context.Context, tenantID string, filter *models.AllocationFilter) ([]models.Allocation, error) {
	if filter == nil {
		filter = &models.AllocationFilter{}
	}
	if filter.Limit <= 0 {
		filter.Limit = 20
	}
	return s.repo.ListAllocations(ctx, tenantID, filter)
}

func (s *Service) UpdateAllocation(ctx context.Context, tenantID, id string, req models.UpdateAllocationRequest) (*models.Allocation, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Type != nil {
		updates["type"] = *req.Type
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}
	if req.SourceAccount != nil {
		updates["source_account"] = *req.SourceAccount
	}
	if req.AllocationKey != nil {
		updates["allocation_key"] = *req.AllocationKey
	}
	if req.AllocationRules != nil {
		updates["allocation_rules"] = string(req.AllocationRules)
	}
	return s.repo.UpdateAllocation(ctx, tenantID, id, updates)
}

func (s *Service) DeleteAllocation(ctx context.Context, tenantID, id string) (bool, error) {
	return s.repo.DeleteAllocation(ctx, tenantID, id)
}

func (s *Service) CreateRule(ctx context.Context, tenantID string, req models.CreateRuleRequest) (*models.Rule, error) {
	_, err := s.repo.GetAllocationByID(ctx, tenantID, req.AllocationID)
	if err != nil {
		return nil, sentinel.NotFound
	}
	rule := &models.Rule{
		AllocationID:   req.AllocationID,
		ConditionType:  req.ConditionType,
		ConditionValue: req.ConditionValue,
		Percentage:     req.Percentage,
		TargetServices: req.TargetServices,
		TargetTags:     req.TargetTags,
	}
	if rule.Percentage == 0 {
		rule.Percentage = 100
	}
	if err := s.repo.CreateRule(ctx, rule); err != nil {
		return nil, err
	}
	return rule, nil
}

func (s *Service) ListRules(ctx context.Context, tenantID, allocationID string) ([]models.Rule, error) {
	return s.repo.ListRulesByAllocation(ctx, tenantID, allocationID)
}

func (s *Service) DeleteRule(ctx context.Context, tenantID, ruleID string) (bool, error) {
	return s.repo.DeleteRule(ctx, tenantID, ruleID)
}

func (s *Service) CreateReport(ctx context.Context, tenantID string, req models.CreateReportRequest) (*models.Report, error) {
	now := time.Now().UTC()
	report := &models.Report{
		TenantID:     tenantID,
		AllocationID: req.AllocationID,
		PeriodStart:  req.PeriodStart,
		PeriodEnd:    req.PeriodEnd,
		Status:       "pending",
		StartedAt:    &now,
	}
	if err := s.repo.CreateReport(ctx, report); err != nil {
		return nil, err
	}
	return report, nil
}

func (s *Service) GetReport(ctx context.Context, tenantID, id string) (*models.Report, error) {
	return s.repo.GetReportByID(ctx, tenantID, id)
}

func (s *Service) ListReports(ctx context.Context, tenantID string, filter *models.ReportFilter) ([]models.Report, error) {
	if filter == nil {
		filter = &models.ReportFilter{}
	}
	if filter.Limit <= 0 {
		filter.Limit = 20
	}
	return s.repo.ListReports(ctx, tenantID, filter)
}

func (s *Service) CompleteReport(ctx context.Context, tenantID, id string, totalCost, allocatedCost float64, resultData string) (*models.Report, error) {
	now := time.Now().UTC()
	updates := map[string]interface{}{
		"status":         "completed",
		"total_cost":     totalCost,
		"allocated_cost": allocatedCost,
		"result_data":    resultData,
		"completed_at":   now,
	}
	return s.repo.UpdateReport(ctx, tenantID, id, updates)
}

func (s *Service) FailReport(ctx context.Context, tenantID, id string, errMsg string) (*models.Report, error) {
	now := time.Now().UTC()
	updates := map[string]interface{}{
		"status":        "failed",
		"error_message": errMsg,
		"completed_at":  now,
	}
	return s.repo.UpdateReport(ctx, tenantID, id, updates)
}

func (s *Service) DeleteReport(ctx context.Context, tenantID, id string) (bool, error) {
	return s.repo.DeleteReport(ctx, tenantID, id)
}
