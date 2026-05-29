package service

import (
	"context"
	"errors"
	"orion/inspection-svc-go/internal/models"
	"orion/inspection-svc-go/internal/repository"
	"github.com/google/uuid"
)

var (
	ErrRuleNotFound   = errors.New("inspection rule not found")
	ErrResultNotFound = errors.New("inspection result not found")
)

type Service struct {
	ruleRepo   *repository.RuleRepository
	resultRepo *repository.ResultRepository
}

func NewService(ruleRepo *repository.RuleRepository, resultRepo *repository.ResultRepository) *Service {
	return &Service{ruleRepo: ruleRepo, resultRepo: resultRepo}
}

func (s *Service) CreateRule(ctx context.Context, tenantID string, req *models.CreateRuleRequest) (*models.InspectionRule, error) {
	rule := &models.InspectionRule{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		RuleType:    req.RuleType,
		Target:      req.Target,
		Condition:   req.Condition,
		Severity:    req.Severity,
		Enabled:     true,
		Schedule:    req.Schedule,
	}
	if rule.Severity == "" { rule.Severity = "medium" }
	if err := s.ruleRepo.Create(ctx, rule); err != nil { return nil, err }
	return rule, nil
}

func (s *Service) ListRules(ctx context.Context, tenantID string, offset, limit int) ([]models.InspectionRule, error) {
	return s.ruleRepo.List(ctx, tenantID, offset, limit)
}

func (s *Service) GetRule(ctx context.Context, tenantID, id string) (*models.InspectionRule, error) {
	return s.ruleRepo.GetByID(ctx, tenantID, id)
}

func (s *Service) UpdateRule(ctx context.Context, tenantID, id string, req *models.CreateRuleRequest) (*models.InspectionRule, error) {
	rule, err := s.ruleRepo.GetByID(ctx, tenantID, id)
	if err != nil { return nil, ErrRuleNotFound }
	rule.Name = req.Name
	rule.Description = req.Description
	rule.RuleType = req.RuleType
	rule.Target = req.Target
	rule.Condition = req.Condition
	rule.Severity = req.Severity
	rule.Schedule = req.Schedule
	if err := s.ruleRepo.Update(ctx, rule); err != nil { return nil, err }
	return rule, nil
}

func (s *Service) DeleteRule(ctx context.Context, tenantID, id string) error {
	return s.ruleRepo.Delete(ctx, tenantID, id)
}

func (s *Service) ListResults(ctx context.Context, tenantID string, offset, limit int) ([]models.InspectionResult, error) {
	return s.resultRepo.List(ctx, tenantID, offset, limit)
}

func (s *Service) ListResultsByRule(ctx context.Context, tenantID, ruleID string, offset, limit int) ([]models.InspectionResult, error) {
	return s.resultRepo.ListByRule(ctx, tenantID, ruleID, offset, limit)
}

func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	return s.ruleRepo.Count(ctx, tenantID)
}
