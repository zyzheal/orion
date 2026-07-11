package service

import (
	"context"

	"orion/incident-svc-go/internal/changeintelligence/models"
	"orion/incident-svc-go/internal/changeintelligence/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateChangeIntelligenceRequest) (*models.ChangeIntelligence, error) {
	m := &models.ChangeIntelligence{TenantID: tenantID, Name: req.Name}
	return m, s.repo.Create(ctx, m)
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.ChangeIntelligence, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}
