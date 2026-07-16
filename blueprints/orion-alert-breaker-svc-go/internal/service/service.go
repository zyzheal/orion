package service

import (
	"context"
	"fmt"

	"orion-alert-breaker-svc-go/internal/models"
	"orion-alert-breaker-svc-go/internal/repository"
)

// AlertBreakerService implements alert breaker business logic.
type AlertBreakerService struct {
	repo *repository.AlertBreakerRepository
}

// NewAlertBreakerService creates a new service.
func NewAlertBreakerService(repo *repository.AlertBreakerRepository) *AlertBreakerService {
	return &AlertBreakerService{repo: repo}
}

// CreateRule creates a new alert breaker rule.
func (s *AlertBreakerService) CreateRule(ctx context.Context, tenantID string, req *models.CreateRuleRequest, actor string) (*models.AlertBreakerRule, error) {
	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	rule := &models.AlertBreakerRule{
		Name:        req.Name,
		Description: req.Description,
		Matchers:    models.JSONB(req.Matchers),
		Actions:     models.JSONB(req.Actions),
		IsActive:    isActive,
		CreatedBy:   actor,
	}

	if err := s.repo.Create(ctx, tenantID, rule); err != nil {
		return nil, fmt.Errorf("failed to create rule: %w", err)
	}
	return rule, nil
}

// GetRule returns a rule by ID.
func (s *AlertBreakerService) GetRule(ctx context.Context, tenantID, id string) (*models.AlertBreakerRule, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

// ListRules returns all rules for a tenant.
func (s *AlertBreakerService) ListRules(ctx context.Context, tenantID string) ([]models.AlertBreakerRule, error) {
	return s.repo.ListByTenant(ctx, tenantID)
}

// UpdateRule updates an existing rule.
func (s *AlertBreakerService) UpdateRule(ctx context.Context, tenantID, id string, req *models.UpdateRuleRequest) (*models.AlertBreakerRule, error) {
	rule, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}

	if req.Name != nil {
		rule.Name = *req.Name
	}
	if req.Description != nil {
		rule.Description = *req.Description
	}
	if req.Matchers != nil {
		rule.Matchers = models.JSONB(req.Matchers)
	}
	if req.Actions != nil {
		rule.Actions = models.JSONB(req.Actions)
	}
	if req.IsActive != nil {
		rule.IsActive = *req.IsActive
	}

	if err := s.repo.Update(ctx, tenantID, id, rule); err != nil {
		return nil, fmt.Errorf("failed to update rule: %w", err)
	}
	return rule, nil
}

// DeleteRule removes a rule.
func (s *AlertBreakerService) DeleteRule(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

// EvaluateRule evaluates rules against alert labels and returns matching actions.
func (s *AlertBreakerService) EvaluateRule(ctx context.Context, tenantID string, req *models.EvaluateRequest) (*models.EvaluateResult, error) {
	rules, err := s.repo.ListByTenant(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to list rules for evaluation: %w", err)
	}

	// TODO: Implement actual label matching logic
	return &models.EvaluateResult{
		RulesApplied: []string{},
		Actions:      []any{},
	}, nil
}
