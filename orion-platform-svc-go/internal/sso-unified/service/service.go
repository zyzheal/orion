package service

import (
	"context"
	"orion/platform-svc-go/internal/sso-unified/models"
	"orion/platform-svc-go/internal/sso-unified/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateSSOConfigRequest) (*models.SSOConfig, error) {
	config := &models.SSOConfig{
		TenantID: tenantID,
		Provider: req.Provider,
		Enabled:  req.Enabled,
		Config:   req.Config,
	}
	if err := s.repo.Create(ctx, config); err != nil {
		return nil, err
	}
	return config, nil
}

func (s *Service) Get(ctx context.Context, tenantID, provider string) (*models.SSOConfig, error) {
	return s.repo.GetByProvider(ctx, tenantID, provider)
}

func (s *Service) GetAll(ctx context.Context, tenantID string) ([]models.SSOConfig, error) {
	return s.repo.GetAll(ctx, tenantID)
}

func (s *Service) Update(ctx context.Context, tenantID, provider string, req *models.UpdateSSOConfigRequest) (*models.SSOConfig, error) {
	updates := make(map[string]interface{})
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}
	if req.Config != nil {
		updates["config"] = req.Config
	}
	return s.repo.Update(ctx, tenantID, provider, updates)
}

func (s *Service) Delete(ctx context.Context, tenantID, provider string) (bool, error) {
	return s.repo.Delete(ctx, tenantID, provider)
}
