package service

import (
	"context"

	"orion/incident-svc-go/internal/oncall/models"
	"orion/incident-svc-go/internal/oncall/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateOncallRequest) (*models.Oncall, error) {
	m := &models.Oncall{TenantID: tenantID, Name: req.Name}
	return m, s.repo.Create(ctx, m)
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.Oncall, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}
