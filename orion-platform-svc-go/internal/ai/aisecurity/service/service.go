package service

import (
	"context"

	"orion/platform-svc-go/internal/ai/aisecurity/models"
	"orion/platform-svc-go/internal/ai/aisecurity/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateAISecurityRequest) (*models.AISecurity, error) {
	m := &models.AISecurity{TenantID: tenantID, Name: req.Name}
	return m, s.repo.Create(ctx, m)
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.AISecurity, error) {
	return s.repo.List(ctx, tenantID)
}
