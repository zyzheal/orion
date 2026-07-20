package service

import (
	"context"
	"errors"

	"orion/platform-svc-go/internal/vector/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CreateStore(ctx context.Context, m *models.VectorStore) error
	DeleteStore(ctx context.Context, tenantID, id string) error
	DeleteVectors(ctx context.Context, tenantID, storeID string, ids []string) (int, error)
	GetStore(ctx context.Context, tenantID, id string) (*models.VectorStore, error)
	ListStores(ctx context.Context, tenantID string, limit, offset int) ([]models.VectorStore, error)
	SearchVectors(ctx context.Context, tenantID, storeID string, vec []float64, limit int) ([]models.SearchResult, error)
	UpsertVector(ctx context.Context, tenantID, storeID string, vec []float64, meta map[string]string) error
}

var ErrNotFound = errors.New("vector store not found")

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func (s *Service) ListStores(ctx context.Context, tenantID string, limit, offset int) ([]models.VectorStore, error) {
	stores, err := s.repo.ListStores(ctx, tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	if stores == nil {
		stores = []models.VectorStore{}
	}
	return stores, nil
}

func (s *Service) GetStore(ctx context.Context, tenantID, id string) (*models.VectorStore, error) {
	return s.repo.GetStore(ctx, tenantID, id)
}

func (s *Service) CreateStore(ctx context.Context, tenantID string, req models.CreateStoreRequest) (*models.VectorStore, error) {
	store := &models.VectorStore{
		TenantID:   tenantID,
		Name:       req.Name,
		Dimensions: req.Dimensions,
		Metric:     req.Metric,
	}
	if store.Metric == "" {
		store.Metric = "cosine"
	}
	if err := s.repo.CreateStore(ctx, store); err != nil {
		return nil, err
	}
	return store, nil
}

func (s *Service) DeleteStore(ctx context.Context, tenantID, id string) error {
	_, err := s.repo.GetStore(ctx, tenantID, id)
	if err != nil {
		return ErrNotFound
	}
	return s.repo.DeleteStore(ctx, tenantID, id)
}

func (s *Service) UpsertVectors(ctx context.Context, tenantID, storeID string, req models.UpsertVectorsRequest) error {
	_, err := s.repo.GetStore(ctx, tenantID, storeID)
	if err != nil {
		return ErrNotFound
	}
	return s.repo.UpsertVector(ctx, tenantID, storeID, req.Vector, req.Metadata)
}

func (s *Service) SearchVectors(ctx context.Context, tenantID, storeID string, q models.SearchQuery) ([]models.SearchResult, error) {
	if q.Limit <= 0 {
		q.Limit = 10
	}
	return s.repo.SearchVectors(ctx, tenantID, storeID, q.Vector, q.Limit)
}

func (s *Service) DeleteVectors(ctx context.Context, tenantID, storeID string, ids []string) (int, error) {
	return s.repo.DeleteVectors(ctx, tenantID, storeID, ids)
}
