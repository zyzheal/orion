package service

import (
	"context"
	"fmt"

	"orion/platform-svc-go/internal/ai/vector/models"
	"orion/platform-svc-go/internal/ai/vector/repository"
	"go.uber.org/zap"
)

type VectorService struct {
	repo   *repository.VectorRepository
	logger *zap.Logger
}

func NewVectorService(repo *repository.VectorRepository, logger *zap.Logger) *VectorService {
	return &VectorService{repo: repo, logger: logger}
}

// CreateStore creates a new vector store.
func (s *VectorService) CreateStore(ctx context.Context, tenantID string, req *models.CreateStoreRequest) (*models.VectorStore, error) {
	if req.Dimensions <= 0 {
		return nil, fmt.Errorf("dimensions must be positive")
	}
	store, err := s.repo.CreateStore(ctx, tenantID, req)
	if err != nil {
		s.logger.Error("failed to create vector store",
			zap.String("name", req.Name),
			zap.Error(err),
		)
		return nil, err
	}
	s.logger.Info("vector store created",
		zap.String("storeId", store.ID),
		zap.Int("dimensions", store.Dimensions),
	)
	return store, nil
}

// QueryStores returns paginated vector stores.
func (s *VectorService) QueryStores(ctx context.Context, tenantID string, limit, offset int) ([]models.VectorStore, int64, error) {
	return s.repo.QueryStores(ctx, tenantID, limit, offset)
}

// GetStore returns a single vector store.
func (s *VectorService) GetStore(ctx context.Context, tenantID, id string) (*models.VectorStore, error) {
	return s.repo.GetStore(ctx, tenantID, id)
}

// UpsertVector inserts or updates a vector.
func (s *VectorService) UpsertVector(ctx context.Context, tenantID, storeID, vectorID string, data []float64, payload string) error {
	store, err := s.repo.GetStore(ctx, tenantID, storeID)
	if err != nil {
		return fmt.Errorf("store not accessible: %s", storeID)
	}
	if len(data) != store.Dimensions {
		return fmt.Errorf("vector dimensions %d do not match store dimensions %d", len(data), store.Dimensions)
	}

	if err := s.repo.UpsertVector(ctx, storeID, vectorID, data, payload); err != nil {
		s.logger.Error("failed to upsert vector",
			zap.String("storeId", storeID),
			zap.String("vectorId", vectorID),
			zap.Error(err),
		)
		return err
	}
	s.logger.Info("vector upserted",
		zap.String("storeId", storeID),
		zap.String("vectorId", vectorID),
	)
	return nil
}

// SearchVectors performs vector similarity search.
func (s *VectorService) SearchVectors(ctx context.Context, tenantID, storeID string, query []float64, topK int) ([]models.SearchResult, error) {
	store, err := s.repo.GetStore(ctx, tenantID, storeID)
	if err != nil {
		return nil, fmt.Errorf("store not accessible: %s", storeID)
	}
	if len(query) != store.Dimensions {
		return nil, fmt.Errorf("query dimensions %d do not match store dimensions %d", len(query), store.Dimensions)
	}

	results, err := s.repo.SearchVectors(ctx, storeID, query, topK)
	if err != nil {
		s.logger.Error("failed to search vectors",
			zap.String("storeId", storeID),
			zap.Error(err),
		)
		return nil, err
	}
	s.logger.Info("vector search completed",
		zap.String("storeId", storeID),
		zap.Int("results", len(results)),
	)
	return results, nil
}

// DeleteVector removes a vector.
func (s *VectorService) DeleteVector(ctx context.Context, tenantID, storeID, vectorID string) error {
	_, err := s.repo.GetStore(ctx, tenantID, storeID)
	if err != nil {
		return fmt.Errorf("store not accessible: %s", storeID)
	}

	if err := s.repo.DeleteVector(ctx, storeID, vectorID); err != nil {
		s.logger.Error("failed to delete vector",
			zap.String("vectorId", vectorID),
			zap.Error(err),
		)
		return err
	}
	s.logger.Info("vector deleted", zap.String("vectorId", vectorID))
	return nil
}

// DeleteStore removes a vector store.
func (s *VectorService) DeleteStore(ctx context.Context, tenantID, id string) error {
	if err := s.repo.DeleteStore(ctx, tenantID, id); err != nil {
		s.logger.Error("failed to delete vector store",
			zap.String("storeId", id),
			zap.Error(err),
		)
		return err
	}
	s.logger.Info("vector store deleted", zap.String("storeId", id))
	return nil
}
