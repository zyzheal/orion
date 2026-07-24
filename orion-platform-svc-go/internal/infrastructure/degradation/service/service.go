package service

import (
	"context"

	"orion/platform-svc-go/internal/infrastructure/degradation/models"
	"orion/platform-svc-go/internal/infrastructure/degradation/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateDegradationRequest) (*models.Degradation, error) {
	m := &models.Degradation{TenantID: tenantID, Name: req.Name}
	return m, s.repo.Create(ctx, m)
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.Degradation, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string, limit, offset int) ([]models.Degradation, error) {
	return s.repo.List(ctx, tenantID, limit, offset)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}
