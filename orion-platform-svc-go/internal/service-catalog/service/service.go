package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"

	"orion/platform-svc-go/internal/service-catalog/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, m *models.ServiceCatalog) error
	Delete(ctx context.Context, tenantID, id string) error
	GetByID(ctx context.Context, tenantID, id string) (*models.ServiceCatalog, error)
	List(ctx context.Context, tenantID string) ([]models.ServiceCatalog, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.ServiceCatalog, error)
	UpdateRequestStatus(ctx context.Context, tenantID, id string, newStatus string, comment string, assignedTo *string, by string) (*models.ServiceRequest, error)
	GetRequestTimeline(ctx context.Context, tenantID, requestID string) ([]models.TimelineEntry, error)
	GetSLABreaches(ctx context.Context, tenantID string, serviceFilter string, from int64, limit int) ([]models.SLABreach, error)
}



type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateServiceCatalogRequest) (*models.ServiceCatalog, error) {
	m := &models.ServiceCatalog{TenantID: tenantID, Name: req.Name, Value: req.Value, Enabled: req.Enabled}
	if err := s.repo.Create(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.ServiceCatalog, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.ServiceCatalog, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req models.UpdateServiceCatalogRequest) (*models.ServiceCatalog, error) {
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
