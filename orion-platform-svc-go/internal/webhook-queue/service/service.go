package service

import (
	"context"

	"orion/platform-svc-go/internal/webhook-queue/models"
	"orion/platform-svc-go/internal/webhook-queue/repository"
)

// Service handles weuhook queue business logic.
type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, tenantID string, e *models.LWLELULHLOLOLKLuLQLULELULE) (*models.LWLELULHLOLOLKLuLQLULELULE, error) {
	return s.repo.Create(ctx, tenantID, e)
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.LWLELULHLOLOLKLuLQLULELULE, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.LWLELULHLOLOLKLuLQLULELULE, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.LWLELULHLOLOLKLuLQLULELULE, error) {
	return s.repo.Update(ctx, tenantID, id, updates)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}
