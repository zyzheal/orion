package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"orion/platform-svc-go/internal/sso-providers/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, provider *models.SSOProvider) error
	Delete(ctx context.Context, tenantID, id string) (bool, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.SSOProvider, error)
	List(ctx context.Context, tenantID string, filter *models.SSOProviderFilter) ([]models.SSOProvider, int, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.SSOProvider, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateSSOProviderRequest) (*models.SSOProvider, error) {
	provider := &models.SSOProvider{
		TenantID: tenantID,
		Name:     req.Name,
		Type:     req.Type,
		Enabled:  req.Enabled,
		Config:   req.Config,
	}
	if err := s.repo.Create(ctx, provider); err != nil {
		return nil, err
	}
	return provider, nil
}

func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.SSOProvider, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string, filter *models.SSOProviderFilter) ([]models.SSOProvider, int, error) {
	return s.repo.List(ctx, tenantID, filter)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req *models.UpdateSSOProviderRequest) (*models.SSOProvider, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Type != nil {
		updates["type"] = *req.Type
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}
	if req.Config != nil {
		updates["config"] = req.Config
	}
	return s.repo.Update(ctx, tenantID, id, updates)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) (bool, error) {
	return s.repo.Delete(ctx, tenantID, id)
}

func (s *Service) TestConnection(ctx context.Context, tenantID, id string) (bool, string, error) {
	_, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return false, "", err
	}
	// TODO: Implement actual connection test based on provider type
	return true, "connection successful", nil
}
