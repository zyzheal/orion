package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"

	"orion/platform-svc-go/internal/metadata/models"

)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	BatchCreate(ctx context.Context, tenantID string, items []models.CreateRequest) ([]models.Record, error)
	Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error)
	Delete(ctx context.Context, tenantID, id string) error
	GetByID(ctx context.Context, tenantID, id string) (*models.Record, error)
	GetStats(ctx context.Context, tenantID string) (*models.Stats, error)
	List(ctx context.Context, tenantID string) ([]models.Record, error)
	Search(ctx context.Context, tenantID string, q models.SearchQuery) ([]models.Record, error)
	Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.Record, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.Record, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error) {
	return s.repo.Create(ctx, tenantID, req)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error) {
	return s.repo.Update(ctx, tenantID, id, req)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

func (s *Service) BatchCreate(ctx context.Context, tenantID string, req models.BatchCreateRequest) ([]models.Record, error) {
	if len(req.Items) == 0 {
		return []models.Record{}, nil
	}
	return s.repo.BatchCreate(ctx, tenantID, req.Items)
}

func (s *Service) Search(ctx context.Context, tenantID string, q models.SearchQuery) ([]models.Record, error) {
	return s.repo.Search(ctx, tenantID, q)
}

func (s *Service) GetStats(ctx context.Context, tenantID string) (*models.Stats, error) {
	return s.repo.GetStats(ctx, tenantID)
}
