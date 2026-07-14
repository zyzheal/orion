package service

import (
	"context"
	"orion/platform-svc-go/internal/canary-analysis/models"
	"orion/platform-svc-go/internal/canary-analysis/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, req *models.CreateRequest, tenantID string) (*models.Analysis, error) {
	entity := &models.Analysis{
		TenantID: tenantID,
		Name:     req.Name,
		Status:   req.Status,
		Metadata: req.Metadata,
	}
	if err := s.repo.Create(ctx, entity); err != nil {
		return nil, err
	}
	return entity, nil
}

func (s *Service) Get(ctx context.Context, id, tenantID string) (*models.Analysis, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.Analysis, error) {
	entities, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	if entities == nil {
		entities = []models.Analysis{}
	}
	return entities, nil
}

func (s *Service) Update(ctx context.Context, id, tenantID string, req *models.UpdateRequest) (*models.Analysis, error) {
	attrs := make(map[string]interface{})
	if req.Name != nil {
		attrs["name"] = *req.Name
	}
	if req.Status != nil {
		attrs["status"] = *req.Status
	}
	if req.Metadata != nil {
		attrs["metadata"] = *req.Metadata
	}
	return s.repo.Update(ctx, tenantID, id, attrs)
}

func (s *Service) Delete(ctx context.Context, id, tenantID string) (bool, error) {
	return s.repo.Delete(ctx, tenantID, id)
}
