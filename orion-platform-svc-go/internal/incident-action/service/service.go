package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"

	"orion/platform-svc-go/internal/incident-action/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, tenantID string, e *models.LILNLCLILDLELNLTLuLALCLTLILOLN) (*models.LILNLCLILDLELNLTLuLALCLTLILOLN, error)
	Delete(ctx context.Context, tenantID, id string) error
	GetByID(ctx context.Context, tenantID, id string) (*models.LILNLCLILDLELNLTLuLALCLTLILOLN, error)
	List(ctx context.Context, tenantID string) ([]models.LILNLCLILDLELNLTLuLALCLTLILOLN, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.LILNLCLILDLELNLTLuLALCLTLILOLN, error)
}

// Service handles incident action business logic.
type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, tenantID string, e *models.LILNLCLILDLELNLTLuLALCLTLILOLN) (*models.LILNLCLILDLELNLTLuLALCLTLILOLN, error) {
	return s.repo.Create(ctx, tenantID, e)
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.LILNLCLILDLELNLTLuLALCLTLILOLN, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.LILNLCLILDLELNLTLuLALCLTLILOLN, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.LILNLCLILDLELNLTLuLALCLTLILOLN, error) {
	return s.repo.Update(ctx, tenantID, id, updates)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}
