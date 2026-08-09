package service

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"orion/platform-svc-go/internal/ai/semantic-search/models"
	"orion/platform-svc-go/internal/ai/semantic-search/repository"
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

// HybridSearch performs a hybrid keyword + vector search with RRF fusion.
// It retrieves results via the existing vector-based search and keyword-based
// search (ILIKE), then fuses the two ranked lists using Reciprocal Rank Fusion.
func (s *SemanticSearchService) HybridSearch(ctx context.Context, tenantID string, query string, topK int) ([]models.SearchResult, error) {
	if query == "" {
		return nil, fmt.Errorf("hybrid search: query is required")
	}
	if topK <= 0 {
		topK = 10
	}

	config, err := s.GetSearchConfig(ctx)
	if err != nil {
		return nil, err
	}
	if config == nil {
		config = &models.SearchConfig{}
		config.SetDefaults()
	}

	// Vector-based search (stored results ordered by score)
	vectorResults, err := s.repo.Search(ctx, query, config.VectorTopK, "")
	if err != nil {
		s.logger.Warn("vector search failed, falling back to keyword-only",
			zap.Error(err))
		vectorResults = []models.SearchResult{}
	}

	// Keyword-based search via repository
	keywordResults, err := s.repo.KeywordSearch(ctx, query, config.KeywordTopK)
	if err != nil {
		s.logger.Warn("keyword search failed, falling back to vector-only",
			zap.Error(err))
		keywordResults = vectorResults // fall back to vector results
	}

	if config.RRFEnabled {
		return s.RecalculateRelevance(
			s.rankedBy(vectorResults),
			s.rankedBy(keywordResults),
			config.RRFK,
			topK,
		), nil
	}

	// Weighted score fusion (non-RRF)
	fused := s.weightedFusion(vectorResults, keywordResults, config.VectorWeight, config.KeywordWeight)
	fused = s.applyThreshold(fused, config.MinScoreThreshold)
	sort.Slice(fused, func(i, j int) bool {
		return fused[i].FusedScore > fused[j].FusedScore
	})
	if len(fused) > topK {
		fused = fused[:topK]
	}
	return fused, nil
}

// ConfigureHybridSearch persists a SearchConfig for a given tenant, enabling
// or tuning the hybrid search behaviour (vector/keyword weights, RRF k, topKs).
func (s *SemanticSearchService) ConfigureHybridSearch(ctx context.Context, tenantID string, config models.SearchConfig) error {
	config.TenantID = tenantID
	config.SetDefaults()

	if err := s.repo.EnsureSearchConfigTable(ctx); err != nil {
		s.logger.Error("failed to ensure search config table", zap.Error(err))
		return fmt.Errorf("configure hybrid search: %w", err)
	}

	if err := s.repo.UpsertSearchConfig(ctx, &config); err != nil {
		s.logger.Error("failed to upsert search config",
			zap.String("tenant", tenantID),
			zap.Error(err),
		)
		return fmt.Errorf("configure hybrid search: %w", err)
	}

	s.logger.Info("hybrid search configured",
		zap.String("tenant", tenantID),
		zap.Float64("vector_weight", config.VectorWeight),
		zap.Float64("keyword_weight", config.KeywordWeight),
		zap.Bool("rrf_enabled", config.RRFEnabled),
		zap.Int("rrf_k", config.RRFK),
	)
	return nil
}

// GetSearchConfig retrieves the stored SearchConfig for a tenant, or returns
// nil if no configuration has been saved yet.
func (s *SemanticSearchService) GetSearchConfig(ctx context.Context) (*models.SearchConfig, error) {
	config, err := s.repo.GetSearchConfig(ctx, "default")
	if err != nil {
		s.logger.Error("failed to get search config", zap.Error(err))
		return nil, fmt.Errorf("get search config: %w", err)
	}
	return config, nil
}

// RecalculateRelevance applies Rank Reciprocal Fusion (RRF) to two ranked
// result lists and returns a single merged list ordered by the fused score.
//
// RRF formula:  score(d) = sum_over_lists( 1 / (k + rank(d)) )
// Default k = 60 (from the "Effectiveness of RRF" paper).
//
// Parameters:
//   - listA, listB: two independently ranked result sets (order matters)
//   - k: RRF constant (typically 60)
//   - topK: maximum number of results to return
func (s *SemanticSearchService) RecalculateRelevance(listA, listB []models.SearchResult, k, topK int) []models.SearchResult {
	if k <= 0 {
		k = 60
	}
	if topK <= 0 {
		topK = 10
	}

	// Build a map keyed by result ID accumulating the RRF score.
	// We keep the first-seen result (from listA) and let subsequent
	// appearances only contribute to the score.
	type rrfEntry struct {
		result   models.SearchResult
		fused    float64
	}

	merged := make(map[string]*rrfEntry)

	// Add listA results with RRF scores
	for i, r := range listA {
		rank := i + 1 // 1-based
		score := 1.0 / float64(k+rank)
		if existing, ok := merged[r.ID]; ok {
			existing.fused += score
		} else {
			merged[r.ID] = &rrfEntry{
				result: r,
				fused:  score,
			}
		}
	}

	// Add listB results with RRF scores
	for i, r := range listB {
		rank := i + 1
		score := 1.0 / float64(k+rank)
		if existing, ok := merged[r.ID]; ok {
			existing.fused += score
			// Keep the higher-scored version
			if r.Score > existing.result.Score {
				existing.result.Score = r.Score
			}
		} else {
			merged[r.ID] = &rrfEntry{
				result: r,
				fused:  score,
			}
		}
	}

	// Collect and sort by fused score descending
	fused := make([]models.SearchResult, 0, len(merged))
	for _, entry := range merged {
		entry.result.Rank = 0 // will be set below
		entry.result.FusedScore = entry.fused
		fused = append(fused, entry.result)
	}

	sort.Slice(fused, func(i, j int) bool {
		if fused[i].FusedScore != fused[j].FusedScore {
			return fused[i].FusedScore > fused[j].FusedScore
		}
		// Tie-break by original score
		return fused[i].Score > fused[j].Score
	})

	// Assign final ranks
	for i := range fused {
		fused[i].Rank = i + 1
	}

	if len(fused) > topK {
		fused = fused[:topK]
	}

	s.logger.Debug("RRF fusion complete",
		zap.Int("input_a", len(listA)),
		zap.Int("input_b", len(listB)),
		zap.Int("output", len(fused)),
		zap.Int("k", k),
	)

	return fused
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

// rankedBy returns results ordered by score descending (used to ensure
// consistent rank ordering before fusion).
func (s *SemanticSearchService) rankedBy(results []models.SearchResult) []models.SearchResult {
	sorted := make([]models.SearchResult, len(results))
	copy(sorted, results)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].Score > sorted[j].Score
	})
	return sorted
}

// weightedFusion merges two result lists using a weighted score formula:
//   fused_score = vector_weight * vector_score + keyword_weight * keyword_score
//
// Results unique to a single list receive the full weight from that side.
func (s *SemanticSearchService) weightedFusion(vectorResults, keywordResults []models.SearchResult, vectorWeight, keywordWeight float64) []models.SearchResult {
	type fusedEntry struct {
		result       models.SearchResult
		vectorScore  float64
		keywordScore float64
		vectorSeen   bool
		keywordSeen  bool
	}

	merged := make(map[string]*fusedEntry)

	for _, r := range vectorResults {
		if existing, ok := merged[r.ID]; ok {
			existing.vectorScore = r.Score
			existing.vectorSeen = true
		} else {
			merged[r.ID] = &fusedEntry{
				result:      r,
				vectorScore: r.Score,
				vectorSeen:  true,
			}
		}
	}

	for _, r := range keywordResults {
		if existing, ok := merged[r.ID]; ok {
			existing.keywordScore = r.Score
			existing.keywordSeen = true
			if r.Title != "" && existing.result.Title == "" {
				existing.result.Title = r.Title
			}
		} else {
			merged[r.ID] = &fusedEntry{
				result:       r,
				keywordScore: r.Score,
				keywordSeen:  true,
			}
		}
	}

	total := vectorWeight + keywordWeight
	if total <= 0 {
		total = 1.0
	}

	fused := make([]models.SearchResult, 0, len(merged))
	for _, entry := range merged {
		score := (entry.vectorScore*vectorWeight + entry.keywordScore*keywordWeight) / total
		entry.result.Score = score
		entry.result.FusedScore = score
		fused = append(fused, entry.result)
	}

	return fused
}

// applyThreshold filters out results below the minimum score threshold.
func (s *SemanticSearchService) applyThreshold(results []models.SearchResult, threshold float64) []models.SearchResult {
	if threshold <= 0 {
		return results
	}
	filtered := make([]models.SearchResult, 0, len(results))
	for _, r := range results {
		if r.FusedScore >= threshold || r.Score >= threshold {
			filtered = append(filtered, r)
		}
	}
	return filtered
}
