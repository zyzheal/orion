package service

import (
	"context"
	errors "errors"
	"orion/finops-svc-go/internal/efficiency/models"
	"orion/finops-svc-go/internal/efficiency/repository"
	"github.com/google/uuid"
)

var ErrEfficiencyMetricNotFound = errors.New("metric not found")

type Service struct { repo *repository.Repository }
func NewService(repo *repository.Repository) *Service { return &Service{repo: repo} }

func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateEfficiencyMetricRequest) (*models.EfficiencyMetric, error) {
	d := &models.EfficiencyMetric{ID: uuid.New().String(), TenantID: tenantID, Name: req.Name}
	return d, s.repo.Create(ctx, d)
}

func (s *Service) List(ctx context.Context, tenantID string, offset, limit int) ([]models.EfficiencyMetric, error) {
	return s.repo.List(ctx, tenantID, offset, limit)
}

func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.EfficiencyMetric, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.Count(ctx, tenantID)
}
