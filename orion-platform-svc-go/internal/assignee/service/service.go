// Package service provides the assignee dispatcher business logic layer.
//
// It wraps the engine and coordinates rule persistence, escalation checks, and
// dispatch lifecycle management.
package service

import (
	"context"
	"fmt"

	"orion/platform-svc-go/internal/assignee/engine"
	"orion/platform-svc-go/internal/assignee/repository"
	"orion/platform-svc-go/internal/assignee/types"
)

// Service is the top-level API for the assignee dispatcher.
type Service struct {
	eng   *engine.Engine
	rules *repository.AssigneeRuleRepository
}

// NewService constructs a Service with the given rule repository.
func NewService(repo *repository.AssigneeRuleRepository) *Service {
	return &Service{
		eng:   engine.NewEngine(),
		rules: repo,
	}
}

// CreateRule persists and activates a new assignee routing rule.
func (s *Service) CreateRule(ctx context.Context, tenantID string, rule *types.AssigneeRule) error {
	if err := rule.Validate(); err != nil {
		return err
	}
	rule.TenantID = tenantID
	if rule.Weight == 0 {
		rule.Weight = 1.0
	}
	if err := s.rules.Create(ctx, rule); err != nil {
		return fmt.Errorf("failed to create rule: %w", err)
	}
	s.reloadRules(ctx, tenantID)
	return nil
}

// ListRules returns all rules for a tenant.
func (s *Service) ListRules(ctx context.Context, tenantID string, enabled *bool, limit, offset int) ([]*types.AssigneeRule, error) {
	return s.rules.List(ctx, tenantID, enabled, limit, offset)
}

// GetRule returns a single rule by ID.
func (s *Service) GetRule(ctx context.Context, tenantID string, id int) (*types.AssigneeRule, error) {
	return s.rules.Get(ctx, tenantID, id)
}

// UpdateRule modifies a rule's fields.
func (s *Service) UpdateRule(ctx context.Context, tenantID string, id int, updates map[string]interface{}) error {
	return s.rules.Update(ctx, tenantID, id, updates)
}

// DeleteRule removes a rule by ID.
func (s *Service) DeleteRule(ctx context.Context, tenantID string, id int) error {
	return s.rules.Delete(ctx, tenantID, id)
}

// Dispatch dispatches a work item using the loaded rules and candidate assignees.
func (s *Service) Dispatch(ctx context.Context, item *types.WorkItem, candidates []*types.AssignmentTarget) (*types.DispatchResult, error) {
	s.reloadRules(ctx, item.TenantID)
	result, err := s.eng.DispatchItem(ctx, item, candidates)
	if err != nil {
		// Check escalation
		esc := s.eng.CheckEscalation(ctx, item, item.CreatedAt, 0)
		if esc != nil {
			return nil, fmt.Errorf("%w (escalation level %d to %s)", err, esc.Level, esc.TargetID)
		}
		return nil, err
	}
	return result, nil
}

// CheckEscalation evaluates whether the given item should be escalated.
func (s *Service) CheckEscalation(ctx context.Context, item *types.WorkItem, currentLevel int) *types.EscalationLevel {
	return s.eng.CheckEscalation(ctx, item, item.CreatedAt, currentLevel)
}

// Capabilities returns the dispatcher capabilities summary.
func (s *Service) Capabilities() *types.DispatcherCapabilities {
	return s.eng.AllCapabilities()
}

// GetAvailableStrategies returns the list of registered dispatch strategies.
func (s *Service) GetAvailableStrategies() []string {
	return s.eng.GetAvailableStrategies()
}

// reloadRules loads all enabled rules from the repository into the engine.
func (s *Service) reloadRules(ctx context.Context, tenantID string) {
	rules, err := s.rules.List(ctx, tenantID, nil, 1000, 0)
	if err != nil {
		return
	}
	s.eng.SetRules(rules)
}
