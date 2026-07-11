package service

import (
	"context"

	"orion-cmdb-svc-go/internal/data-quality/models"
	"orion-cmdb-svc-go/internal/data-quality/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateDataQualityRequest) (*models.DataQuality, error) {
	m := &models.DataQuality{
		TenantID: tenantID,
		Name:     req.Name,
	}
	if err := s.repo.Create(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.DataQuality, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string, limit, offset int) ([]models.DataQuality, error) {
	return s.repo.List(ctx, tenantID, limit, offset)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req models.UpdateDataQualityRequest) (*models.DataQuality, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if err := s.repo.Update(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}
