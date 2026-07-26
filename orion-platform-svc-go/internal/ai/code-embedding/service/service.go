package service

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/ai/code-embedding/models"
	"go.uber.org/zap"
)

type CodeEmbeddingService struct {
	embeddings map[string]*models.CodeEmbedding
	logger     *zap.Logger
}

func NewCodeEmbeddingService(logger *zap.Logger) *CodeEmbeddingService {
	return &CodeEmbeddingService{
		embeddings: make(map[string]*models.CodeEmbedding),
		logger:     logger,
	}
}

// Embed generates an embedding for a code snippet.
func (s *CodeEmbeddingService) Embed(ctx context.Context, tenantID string, req *models.EmbedRequest) (*models.EmbedResponse, error) {
	// Generate embedding vector (simulated)
	vector := s.generateVector(req.Content, req.Language)
	now := time.Now()
	id := fmt.Sprintf("emb_%d", time.Now().UnixNano())

	model := req.Model
	if model == "" {
		model = "code-embedding-3-small"
	}

	embedding := &models.CodeEmbedding{
		ID:        id,
		TenantID:  tenantID,
		RepoID:    req.RepoID,
		FilePath:  req.FilePath,
		Language:  req.Language,
		Content:   req.Content,
		Vector:    vector,
		Model:     model,
		CreatedAt: now,
	}

	s.embeddings[id] = embedding

	s.logger.Info("code embedded",
		zap.String("embeddingId", id),
		zap.String("repoId", req.RepoID),
		zap.String("filePath", req.FilePath),
		zap.String("language", req.Language),
		zap.Int("vectorDim", len(vector)),
	)

	return &models.EmbedResponse{Embedding: embedding}, nil
}

// Search searches for similar code.
func (s *CodeEmbeddingService) Search(ctx context.Context, tenantID string, req *models.SearchRequest) (*models.SearchResponse, error) {
	topK := req.TopK
	if topK <= 0 {
		topK = 5
	}

	queryVector := s.generateVector(req.Query, req.Language)
	var results []models.SearchResult

	for _, emb := range s.embeddings {
		if emb.TenantID != tenantID {
			continue
		}
		if req.RepoID != "" && emb.RepoID != req.RepoID {
			continue
		}
		if req.Language != "" && emb.Language != req.Language {
			continue
		}

		score := s.cosineSimilarity(queryVector, emb.Vector)
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
	// Generate a simple hash-based vector (simulated embedding)
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
