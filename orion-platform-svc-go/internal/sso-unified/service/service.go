package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"orion/platform-svc-go/internal/sso-unified/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, config *models.SSOConfig) error
	Delete(ctx context.Context, tenantID, provider string) (bool, error)
	GetAll(ctx context.Context, tenantID string) ([]models.SSOConfig, error)
	GetByProvider(ctx context.Context, tenantID, provider string) (*models.SSOConfig, error)
	Update(ctx context.Context, tenantID, provider string, updates map[string]interface{}) (*models.SSOConfig, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
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
