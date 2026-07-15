package service

import (
	"context"

	"orion/platform-svc-go/internal/event-trigger-registry/models"
	"orion/platform-svc-go/internal/event-trigger-registry/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) ListTriggers(ctx context.Context, tenantID string) ([]models.WorkflowTrigger, error) {
	items, _, err := s.repo.FindAll(ctx)
	return items, err
}

func (s *Service) GetTrigger(ctx context.Context, tenantID, id string) (*models.WorkflowTrigger, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *Service) CreateTrigger(ctx context.Context, tenantID string, req models.CreateTriggerRequest) (*models.WorkflowTrigger, error) {
	m := &models.WorkflowTrigger{
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
	existing, err := s.repo.GetByID(ctx, id)
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
	return s.repo.Delete(ctx, id)
}
