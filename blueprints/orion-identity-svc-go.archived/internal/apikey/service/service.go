package service

import (
	"context"

	"orion/identity-svc-go/internal/apikey/models"
	"orion/identity-svc-go/internal/apikey/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateApiKeyRequest) (*models.ApiKey, error) {
	m := &models.ApiKey{TenantID: tenantID, Name: req.Name}
	return m, s.repo.Create(ctx, m)
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.ApiKey, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}
