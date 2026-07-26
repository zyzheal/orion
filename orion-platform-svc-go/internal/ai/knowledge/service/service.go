package service

import (
	"context"
	"fmt"

	"orion/platform-svc-go/internal/ai/knowledge/models"
	"orion/platform-svc-go/internal/ai/knowledge/repository"
	"go.uber.org/zap"
)

type KnowledgeService struct {
	repo   *repository.KnowledgeRepository
	logger *zap.Logger
}

func NewKnowledgeService(repo *repository.KnowledgeRepository, logger *zap.Logger) *KnowledgeService {
	return &KnowledgeService{repo: repo, logger: logger}
}

// CreateBase creates a new knowledge base.
func (s *KnowledgeService) CreateBase(ctx context.Context, tenantID string, req *models.CreateBaseRequest) (*models.KnowledgeBase, error) {
	base, err := s.repo.CreateBase(ctx, tenantID, req)
	if err != nil {
		s.logger.Error("failed to create knowledge base",
			zap.String("name", req.Name),
			zap.Error(err),
		)
		return nil, err
	}
	s.logger.Info("knowledge base created",
		zap.String("baseId", base.ID),
		zap.String("name", base.Name),
	)
	return base, nil
}

// QueryBases returns paginated knowledge bases.
func (s *KnowledgeService) QueryBases(ctx context.Context, tenantID string, limit, offset int) (models.KnowledgeBaseResponse, error) {
	return s.repo.QueryBases(ctx, tenantID, limit, offset)
}

// GetBase returns a single knowledge base.
func (s *KnowledgeService) GetBase(ctx context.Context, tenantID, id string) (*models.KnowledgeBase, error) {
	return s.repo.GetBase(ctx, tenantID, id)
}

// AddDocument adds a document to a knowledge base.
func (s *KnowledgeService) AddDocument(ctx context.Context, baseID string, title, content, metadata string) (*models.Document, error) {
	// Validate
	if title == "" {
		return nil, fmt.Errorf("title is required")
	}
	if content == "" {
		return nil, fmt.Errorf("content is required")
	}

	doc, err := s.repo.AddDocument(ctx, baseID, title, content, metadata)
	if err != nil {
		s.logger.Error("failed to add document",
			zap.String("baseId", baseID),
			zap.String("title", title),
			zap.Error(err),
		)
		return nil, err
	}
	s.logger.Info("document added",
		zap.String("documentId", doc.ID),
		zap.String("baseId", baseID),
	)
	return doc, nil
}

// QueryDocuments returns paginated documents.
func (s *KnowledgeService) QueryDocuments(ctx context.Context, baseID string, limit, offset int) (models.DocumentResponse, error) {
	return s.repo.QueryDocuments(ctx, baseID, limit, offset)
}

// DeleteDocument removes a document.
func (s *KnowledgeService) DeleteDocument(ctx context.Context, id string) error {
	if err := s.repo.DeleteDocument(ctx, id); err != nil {
		s.logger.Error("failed to delete document",
			zap.String("documentId", id),
			zap.Error(err),
		)
		return err
	}
	s.logger.Info("document deleted", zap.String("documentId", id))
	return nil
}

// DeleteBase removes a knowledge base.
func (s *KnowledgeService) DeleteBase(ctx context.Context, tenantID, id string) error {
	if err := s.repo.DeleteBase(ctx, tenantID, id); err != nil {
		s.logger.Error("failed to delete knowledge base",
			zap.String("baseId", id),
			zap.Error(err),
		)
		return err
	}
	s.logger.Info("knowledge base deleted", zap.String("baseId", id))
	return nil
}

// Search performs semantic search on a knowledge base.
func (s *KnowledgeService) Search(ctx context.Context, tenantID string, req *models.QueryRequest) (*models.SearchResponse, error) {
	if req.TopK <= 0 {
		req.TopK = 5
	}

	// Verify the base belongs to the tenant
	base, err := s.repo.GetBase(ctx, tenantID, req.BaseID)
	if err != nil {
		s.logger.Warn("search failed: base not accessible",
			zap.String("baseId", req.BaseID),
			zap.Error(err),
		)
		return nil, err
	}
	if !base.IsEnabled {
		return nil, fmt.Errorf("knowledge base is disabled: %s", base.ID)
	}

	results, err := s.repo.SearchDocuments(ctx, req.BaseID, req.Query, req.TopK, req.Filters, req.ScoreThresh)
	if err != nil {
		s.logger.Error("failed to search documents",
			zap.String("query", req.Query),
			zap.String("baseId", req.BaseID),
			zap.Error(err),
		)
		return nil, err
	}

	s.logger.Info("search completed",
		zap.String("query", req.Query),
		zap.Int("results", len(results)),
		zap.String("baseId", req.BaseID),
	)
	return &models.SearchResponse{
		Query:   req.Query,
		TopK:    req.TopK,
		Results: results,
	}, nil
}
