package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"orion/platform-svc-go/internal/apm/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, entity *models.ApmEntry) error
	Delete(ctx context.Context, id, tenantID string) (bool, error)
	GetByID(ctx context.Context, id, tenantID string) (*models.ApmEntry, error)
	List(ctx context.Context, tenantID string) ([]models.ApmEntry, error)
	Update(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.ApmEntry, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, req *models.CreateRequest, tenantID string) (*models.ApmEntry, error) {
	entity := &models.ApmEntry{TenantID: tenantID, Name: req.Name}
	if err := s.repo.Create(ctx, entity); err != nil {
		return nil, err
	}
	return entity, nil
}

func (s *Service) Get(ctx context.Context, id, tenantID string) (*models.ApmEntry, error) {
	return s.repo.GetByID(ctx, id, tenantID)
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.ApmEntry, error) {
	entities, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	if entities == nil {
		entities = []models.ApmEntry{}
	}
	return entities, nil
}

func (s *Service) Update(ctx context.Context, id, tenantID string, req *models.UpdateRequest) (*models.ApmEntry, error) {
	attrs := make(map[string]interface{})
	if req.Name != nil {
		attrs["name"] = *req.Name
	}
	return s.repo.Update(ctx, id, tenantID, attrs)
}

func (s *Service) Delete(ctx context.Context, id, tenantID string) (bool, error) {
	return s.repo.Delete(ctx, id, tenantID)
}
