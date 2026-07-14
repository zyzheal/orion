package service

import (
	"context"

	"orion/platform-svc-go/internal/webhook-pipeline/models"
	"orion/platform-svc-go/internal/webhook-pipeline/repository"
)

// Service handles weuhook pipeline business logic.
type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, tenantID string, e *models.LWLELULHLOLOLKLuLPLILPLELLLILNLE) (*models.LWLELULHLOLOLKLuLPLILPLELLLILNLE, error) {
	return s.repo.Create(ctx, tenantID, e)
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.LWLELULHLOLOLKLuLPLILPLELLLILNLE, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.LWLELULHLOLOLKLuLPLILPLELLLILNLE, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.LWLELULHLOLOLKLuLPLILPLELLLILNLE, error) {
	return s.repo.Update(ctx, tenantID, id, updates)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}
