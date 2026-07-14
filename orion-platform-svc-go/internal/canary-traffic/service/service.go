package service

import (
	"context"
	"orion/platform-svc-go/internal/canary-traffic/models"
	"orion/platform-svc-go/internal/canary-traffic/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, req *models.CreateRequest, tenantID string) (*models.CanaryTraffic, error) {
	entity := &models.CanaryTraffic{TenantID: tenantID, Name: req.Name}
	if err := s.repo.Create(ctx, entity); err != nil {
		return nil, err
	}
	return entity, nil
}

func (s *Service) Get(ctx context.Context, id, tenantID string) (*models.CanaryTraffic, error) {
	return s.repo.GetByID(ctx, id, tenantID)
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.CanaryTraffic, error) {
	entities, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	if entities == nil {
		entities = []models.CanaryTraffic{}
	}
	return entities, nil
}

func (s *Service) Update(ctx context.Context, id, tenantID string, req *models.UpdateRequest) (*models.CanaryTraffic, error) {
	attrs := make(map[string]interface{})
	if req.Name != nil {
		attrs["name"] = *req.Name
	}
	return s.repo.Update(ctx, id, tenantID, attrs)
}

func (s *Service) Delete(ctx context.Context, id, tenantID string) (bool, error) {
	return s.repo.Delete(ctx, id, tenantID)
}
