package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"

	"orion/platform-svc-go/internal/oci-registry/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, m *models.OciRegistry) error
	Delete(ctx context.Context, tenantID, id string) error
	GetByID(ctx context.Context, tenantID, id string) (*models.OciRegistry, error)
	List(ctx context.Context, tenantID string) ([]models.OciRegistry, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.OciRegistry, error)

}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateOciRegistryRequest) (*models.OciRegistry, error) {
	m := &models.OciRegistry{TenantID: tenantID, Name: req.Name, Value: req.Value, Enabled: req.Enabled}
	if err := s.repo.Create(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.OciRegistry, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.OciRegistry, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req models.UpdateOciRegistryRequest) (*models.OciRegistry, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Value != nil {
		updates["value"] = *req.Value
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}
	return s.repo.Update(ctx, tenantID, id, updates)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}
