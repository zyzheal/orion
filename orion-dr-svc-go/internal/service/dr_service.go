package service

import (
	"context"
	errors "errors"
	"orion/dr-svc-go/internal/models"
	"orion/dr-svc-go/internal/repository"
	"github.com/google/uuid"
)

var ErrDRPlanNotFound = errors.New("plan not found")

type Service struct { repo *repository.Repository }
func NewService(repo *repository.Repository) *Service { return &Service{repo: repo} }

func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateDRPlanRequest) (*models.DRPlan, error) {
	d := &models.DRPlan{ID: uuid.New().String(), TenantID: tenantID, Name: req.Name}
	return d, s.repo.Create(ctx, d)
}

func (s *Service) List(ctx context.Context, tenantID string, offset, limit int) ([]models.DRPlan, error) {
	return s.repo.List(ctx, tenantID, offset, limit)
}

func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.DRPlan, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.Count(ctx, tenantID)
}
