package service

import (
	"context"

	"orion/platform-svc-go/internal/config/internal/global-param/models"
	"orion/platform-svc-go/internal/config/internal/global-param/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateGlobalParamRequest) (*models.GlobalParam, error) {
	m := &models.GlobalParam{
		TenantID: tenantID,
		Name:     req.Name,
	}
	if err := s.repo.Create(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.GlobalParam, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string, limit, offset int) ([]models.GlobalParam, error) {
	return s.repo.List(ctx, tenantID, limit, offset)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req models.UpdateGlobalParamRequest) (*models.GlobalParam, error) {
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
