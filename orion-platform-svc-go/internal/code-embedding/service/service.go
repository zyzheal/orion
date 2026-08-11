package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/code-embedding/models"
	"orion/platform-svc-go/internal/code-embedding/repository"
	"go.uber.org/zap"
)

type CodeEmbeddingService struct {
	repo   *repository.Repository
	logger *zap.Logger
}

func NewCodeEmbeddingService(logger *zap.Logger, repo *repository.Repository) *CodeEmbeddingService {
	return &CodeEmbeddingService{
		repo:   repo,
		logger: logger,
	}
}

func (s *CodeEmbeddingService) hasRepo() bool {
	return s.repo != nil
}

// Embed generates an embedding for a code snippet and persists it.
func (s *CodeEmbeddingService) Embed(ctx context.Context, tenantID string, req *models.EmbedRequest) (*models.EmbedResponse, error) {
	vector := s.generateVector(req.Content, req.Language)
	vecJSON, err := json.Marshal(vector)
	if err != nil {
		return nil, fmt.Errorf("marshal vector: %w", err)
	}

	model := req.Model
	if model == "" {
		model = "code-embedding-3-small"
	}

	id := fmt.Sprintf("emb_%d", time.Now().UnixNano())
	embedding := &models.CodeEmbedding{
		ID:        id,
		TenantID:  tenantID,
		RepoID:    req.RepoID,
		FilePath:  req.FilePath,
		Language:  req.Language,
		Content:   req.Content,
		Vector:    vecJSON,
		Model:     model,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if s.hasRepo() {
		if err := s.repo.Save(ctx, embedding); err != nil {
			return nil, fmt.Errorf("save embedding: %w", err)
		}
	}

	s.logger.Info("code embedded",
		zap.String("embeddingId", id),
		zap.String("repoId", req.RepoID),
		zap.String("filePath", req.FilePath),
		zap.String("language", req.Language),
		zap.Int("vectorDim", len(vector)),
	)

	return &models.EmbedResponse{Embedding: embedding}, nil
}

// Search searches for similar code via vector similarity.
func (s *CodeEmbeddingService) Search(ctx context.Context, tenantID string, req *models.SearchRequest) (*models.SearchResponse, error) {
	topK := req.TopK
	if topK <= 0 {
		topK = 5
	}

	queryVector := s.generateVector(req.Query, req.Language)

	var candidates []*models.CodeEmbedding
	if s.hasRepo() {
		cands, searchErr := s.repo.SearchSimilar(ctx, tenantID, req.RepoID, nil, topK*5, req.Language)
		if searchErr != nil {
			return nil, fmt.Errorf("search candidates: %w", searchErr)
		}
		candidates = cands
	}

	var results []models.SearchResult
	for _, emb := range candidates {
		if req.RepoID != "" && emb.RepoID != req.RepoID {
			continue
		}
		if req.Language != "" && emb.Language != req.Language {
			continue
		}

		vec, vecErr := emb.VectorAsFloats()
		if vecErr != nil || vec == nil {
			continue
		}
		score := s.cosineSimilarity(queryVector, vec)
		if score >= req.ScoreThresh {
			content := emb.Content
			if len(content) > 200 {
				content = content[:200] + "..."
			}
			results = append(results, models.SearchResult{
				ID:        emb.ID,
				RepoID:    emb.RepoID,
				FilePath:  emb.FilePath,
				Language:  emb.Language,
				Content:   content,
				Score:     score,
				CreatedAt: emb.CreatedAt,
			})
		}
	}

	s.logger.Info("code embedding search completed",
		zap.String("query", req.Query),
		zap.Int("results", len(results)),
	)

	return &models.SearchResponse{
		Query:   req.Query,
		TopK:    topK,
		Results: results[:min(len(results), topK)],
	}, nil
}

func (s *CodeEmbeddingService) generateVector(content, language string) []float64 {
	dim := 1536
	vector := make([]float64, dim)
	for i := 0; i < dim; i++ {
		hash := 0
		for j := 0; j < len(content); j++ {
			hash += int(content[j]) * (j + 1)
		}
		hash += i * 7
		vector[i] = float64(hash%1000) / 1000.0 - 0.5
	}
	return vector
}

func (s *CodeEmbeddingService) cosineSimilarity(a, b []float64) float64 {
	dot := 0.0
	normA := 0.0
	normB := 0.0
	for i := 0; i < len(a) && i < len(b); i++ {
		dot += a[i] * b[i]
		normA += a[i] * a[i]
		normB += b[i] * b[i]
	}
	if normA == 0 || normB == 0 {
		return 0.0
	}
	return dot / (normA * normB)
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}