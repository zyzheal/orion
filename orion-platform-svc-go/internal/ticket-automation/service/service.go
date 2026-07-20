package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"

	"orion/platform-svc-go/internal/ticket-automation/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, tenantID string, e *models.LTLILCLKLELTLuLALULTLOLMLALTLILOLN) (*models.LTLILCLKLELTLuLALULTLOLMLALTLILOLN, error)
	Delete(ctx context.Context, tenantID, id string) error
	GetByID(ctx context.Context, tenantID, id string) (*models.LTLILCLKLELTLuLALULTLOLMLALTLILOLN, error)
	List(ctx context.Context, tenantID string) ([]models.LTLILCLKLELTLuLALULTLOLMLALTLILOLN, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.LTLILCLKLELTLuLALULTLOLMLALTLILOLN, error)
}

// Service handles ticket automation business logic.
type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, tenantID string, e *models.LTLILCLKLELTLuLALULTLOLMLALTLILOLN) (*models.LTLILCLKLELTLuLALULTLOLMLALTLILOLN, error) {
	return s.repo.Create(ctx, tenantID, e)
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.LTLILCLKLELTLuLALULTLOLMLALTLILOLN, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.LTLILCLKLELTLuLALULTLOLMLALTLILOLN, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.LTLILCLKLELTLuLALULTLOLMLALTLILOLN, error) {
	return s.repo.Update(ctx, tenantID, id, updates)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}
