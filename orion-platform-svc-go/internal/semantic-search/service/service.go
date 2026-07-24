package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/semantic-search/models"
	"orion/platform-svc-go/internal/semantic-search/repository"
	"go.uber.org/zap"
)

type SemanticSearchService struct {
	repo   *repository.SemanticSearchRepository
	logger *zap.Logger
}

func NewSemanticSearchService(repo *repository.SemanticSearchRepository, logger *zap.Logger) *SemanticSearchService {
	return &SemanticSearchService{repo: repo, logger: logger}
}

// Search performs semantic search.
func (s *SemanticSearchService) Search(ctx context.Context, tenantID string, req *models.SearchRequest) (*models.SearchResponse, error) {
	start := time.Now()
	if req.TopK <= 0 {
		req.TopK = 10
	}

	// Build filters from sources
	var filters []string
	for _, src := range req.Sources {
		if src.Filters != "" {
			filters = append(filters, src.Filters)
		}
	}

	filterStr := strings.Join(filters, ",")
	results, err := s.repo.Search(ctx, req.Query, req.TopK, filterStr)
	if err != nil {
		s.logger.Error("failed to search",
			zap.String("query", req.Query),
			zap.Error(err),
		)
		return nil, err
	}

	s.logger.Info("semantic search completed",
		zap.String("query", req.Query),
		zap.Int("results", len(results)),
		zap.Duration("duration", time.Since(start)),
	)

	return &models.SearchResponse{
		Query:      req.Query,
		TopK:       req.TopK,
		Total:      int64(len(results)),
		Results:    results,
		Summary:    s.generateSummary(results),
		SearchTime: time.Since(start),
	}, nil
}

// IndexContent indexes content.
func (s *SemanticSearchService) IndexContent(ctx context.Context, tenantID string, req *models.IndexRequest) error {
	if err := s.repo.IndexContent(ctx, req.Source, req.Title, req.Content, req.Metadata); err != nil {
		s.logger.Error("failed to index content",
			zap.String("source", req.Source),
			zap.Error(err),
		)
		return err
	}
	s.logger.Info("content indexed", zap.String("source", req.Source))
	return nil
}

func (s *SemanticSearchService) generateSummary(results []models.SearchResult) string {
	if len(results) == 0 {
		return "No results found."
	}
	var summary strings.Builder
	summary.WriteString(fmt.Sprintf("Found %d relevant results:\n", len(results)))
	for i, r := range results {
		content := r.Content
		if len(content) > 200 {
			content = content[:200] + "..."
		}
		summary.WriteString(fmt.Sprintf("\n%d. [%s] %s (score: %.3f)\n%s\n",
			i+1, r.Source, r.Title, r.Score, content))
	}
	return summary.String()
}
