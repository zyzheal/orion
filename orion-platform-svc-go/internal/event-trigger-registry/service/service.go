package service

import (
	"context"

	"orion/platform-svc-go/internal/event-trigger-registry/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, m *models.WorkflowTrigger) error
	Delete(ctx context.Context, id, tenantID string) error
	FindAll(ctx context.Context, tenantID string) ([]models.WorkflowTrigger, int, error)
	GetByID(ctx context.Context, id, tenantID string) (*models.WorkflowTrigger, error)
	Update(ctx context.Context, m *models.WorkflowTrigger) error
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func (s *Service) ListTriggers(ctx context.Context, tenantID string) ([]models.WorkflowTrigger, error) {
	items, _, err := s.repo.FindAll(ctx, tenantID)
	return items, err
}

func (s *Service) GetTrigger(ctx context.Context, tenantID, id string) (*models.WorkflowTrigger, error) {
	return s.repo.GetByID(ctx, id, tenantID)
}

func (s *Service) CreateTrigger(ctx context.Context, tenantID string, req models.CreateTriggerRequest) (*models.WorkflowTrigger, error) {
	m := &models.WorkflowTrigger{
		TenantID:       tenantID,
		Name:           req.Name,
		Type:           req.Type,
		WorkflowID:     req.WorkflowID,
		EventType:      req.EventType,
		EventFilter:    req.EventFilter,
		CronExpression: req.CronExpression,
		Enabled:        req.Enabled,
	}
	if err := s.repo.Create(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) UpdateTrigger(ctx context.Context, tenantID, id string, req models.CreateTriggerRequest) (*models.WorkflowTrigger, error) {
	existing, err := s.repo.GetByID(ctx, id, tenantID)
	if err != nil {
		return nil, err
	}
	existing.Name = req.Name
	existing.Type = req.Type
	existing.WorkflowID = req.WorkflowID
	existing.EventType = req.EventType
	existing.EventFilter = req.EventFilter
	existing.CronExpression = req.CronExpression
	existing.Enabled = req.Enabled
	if err := s.repo.Update(ctx, existing); err != nil {
		return nil, err
	}
	return existing, nil
}

func (s *Service) DeleteTrigger(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, id, tenantID)
}
