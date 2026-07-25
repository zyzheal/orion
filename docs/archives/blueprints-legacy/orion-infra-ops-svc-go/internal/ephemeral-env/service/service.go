package service

import (
	"context"

	"orion/infra-ops-svc-go/internal/ephemeral-env/models"
	"orion/infra-ops-svc-go/internal/ephemeral-env/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateEphemeralEnvRequest) (*models.EphemeralEnv, error) {
	m := &models.EphemeralEnv{TenantID: tenantID, Name: req.Name}
	return m, s.repo.Create(ctx, m)
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.EphemeralEnv, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string, limit, offset int) ([]models.EphemeralEnv, error) {
	return s.repo.List(ctx, tenantID, limit, offset)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}
