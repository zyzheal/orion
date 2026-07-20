package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"orion/platform-svc-go/internal/config-mgmt-enhanced/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, entity *models.ConfigMgmt) error
	Delete(ctx context.Context, id, tenantID string) (bool, error)
	GetByID(ctx context.Context, id, tenantID string) (*models.ConfigMgmt, error)
	List(ctx context.Context, tenantID string) ([]models.ConfigMgmt, error)
	Update(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.ConfigMgmt, error)
	AddChangeHistory(ctx context.Context, h *models.ChangeHistory) error
	UpdateChangeRequest(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.ChangeRequest, error)
	GetChangeRequest(ctx context.Context, id, tenantID string) (*models.ChangeRequest, error)
	UpdateDriftReport(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.DriftReport, error)
	GetDriftReport(ctx context.Context, id, tenantID string) (*models.DriftReport, error)
	CreateDriftReport(ctx context.Context, dr *models.DriftReport) error
	GetChangeHistory(ctx context.Context, changeRequestID, tenantID string) ([]models.ChangeHistory, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, req *models.CreateRequest, tenantID string) (*models.ConfigMgmt, error) {
	entity := &models.ConfigMgmt{TenantID: tenantID, Name: req.Name}
	if err := s.repo.Create(ctx, entity); err != nil {
		return nil, err
	}
	return entity, nil
}

func (s *Service) Get(ctx context.Context, id, tenantID string) (*models.ConfigMgmt, error) {
	return s.repo.GetByID(ctx, id, tenantID)
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.ConfigMgmt, error) {
	entities, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	if entities == nil {
		entities = []models.ConfigMgmt{}
	}
	return entities, nil
}

func (s *Service) Update(ctx context.Context, id, tenantID string, req *models.UpdateRequest) (*models.ConfigMgmt, error) {
	attrs := make(map[string]interface{})
	if req.Name != nil {
		attrs["name"] = *req.Name
	}
	return s.repo.Update(ctx, id, tenantID, attrs)
}

func (s *Service) Delete(ctx context.Context, id, tenantID string) (bool, error) {
	return s.repo.Delete(ctx, id, tenantID)
}
