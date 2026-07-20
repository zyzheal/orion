package service

import (
	"context"
	"errors"

	"orion/platform-svc-go/internal/escalation/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, rule *models.EscalationRule) error
	Delete(ctx context.Context, tenantID, id string) error
	GetByID(ctx context.Context, tenantID, id string) (*models.EscalationRule, error)
	GetEventHistory(ctx context.Context, ruleID string) ([]models.TriggerEvent, error)
	GetStats(ctx context.Context, tenantID string) (*models.EscalationStats, error)
	List(ctx context.Context, tenantID string, q models.ListRulesQuery) ([]models.EscalationRule, error)
	RecordEvent(ctx context.Context, ruleID, message string) (*models.TriggerEvent, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
}

var (
	ErrNotFound = errors.New("escalation rule not found")
)

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func (s *Service) ListRules(ctx context.Context, tenantID string, q models.ListRulesQuery) ([]models.EscalationRule, error) {
	rules, err := s.repo.List(ctx, tenantID, q)
	if err != nil {
		return nil, err
	}
	if rules == nil {
		rules = []models.EscalationRule{}
	}
	return rules, nil
}

func (s *Service) GetRule(ctx context.Context, tenantID, id string) (*models.EscalationRule, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) CreateRule(ctx context.Context, tenantID string, req models.TriggerRequest) (*models.EscalationRule, error) {
	rule := &models.EscalationRule{
		TenantID: tenantID,
		Name:     req.Message,
		Status:   "active",
	}
	if err := s.repo.Create(ctx, rule); err != nil {
		return nil, err
	}
	return rule, nil
}

func (s *Service) UpdateRule(ctx context.Context, tenantID, id string, req models.TriggerRequest) (*models.EscalationRule, error) {
	updates := map[string]interface{}{"name": req.Message}
	if err := s.repo.Update(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) DeleteRule(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

func (s *Service) TriggerRule(ctx context.Context, tenantID, id string, req models.TriggerRequest) (*models.TriggerEvent, error) {
	_, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrNotFound
	}
	event, err := s.repo.RecordEvent(ctx, id, req.Message)
	if err != nil {
		return nil, err
	}
	return event, nil
}

func (s *Service) GetEventsByRule(ctx context.Context, tenantID, ruleID string) ([]models.TriggerEvent, error) {
	events, err := s.repo.GetEventHistory(ctx, ruleID)
	if err != nil {
		return nil, err
	}
	if events == nil {
		events = []models.TriggerEvent{}
	}
	return events, nil
}

func (s *Service) GetStats(ctx context.Context, tenantID string) (*models.EscalationStats, error) {
	return s.repo.GetStats(ctx, tenantID)
}
