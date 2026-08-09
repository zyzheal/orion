package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/ai/semantic-search/models"
)

type SemanticSearchRepository struct {
	DB *sql.DB
}

func NewSemanticSearchRepository(db *sql.DB) *SemanticSearchRepository {
	return &SemanticSearchRepository{DB: db}
}

// Search performs semantic search across multiple sources.
func (r *SemanticSearchRepository) Search(ctx context.Context, query string, topK int, filters string) ([]models.SearchResult, error) {
	if topK <= 0 {
		topK = 10
	}

	where := []string{}
	args := []interface{}{}
	argIdx := 1

	if filters != "" {
		where = append(where, fmt.Sprintf("(title ILIKE $%d OR content ILIKE $%d)", argIdx, argIdx))
		args = append(args, "%"+filters+"%", "%"+filters+"%")
		argIdx++
	}

	whereClause := ""
	if len(where) > 0 {
		whereClause = "WHERE " + joinStrings(where, " AND ")
	}

	rows, err := r.DB.QueryContext(ctx,
		fmt.Sprintf(`
			SELECT id, source, title, content, score, metadata
			FROM semantic_search_results %s
			ORDER BY score DESC
			LIMIT $%d`,
			whereClause, argIdx),
		append(args, topK)...,
	)
	if err != nil {
		return nil, fmt.Errorf("semantic search: %w", err)
	}
	defer rows.Close()

	var results []models.SearchResult
	for rows.Next() {
		var r models.SearchResult
		var metadataStr sql.NullString
		if err := rows.Scan(&r.ID, &r.Source, &r.Title, &r.Content, &r.Score, &metadataStr); err != nil {
			return nil, fmt.Errorf("scan result: %w", err)
		}
		if metadataStr.Valid {
			r.Metadata = metadataStr.String
		}
		results = append(results, r)
	}
	return results, nil
}

// StoreResult stores a search result.
func (r *SemanticSearchRepository) StoreResult(ctx context.Context, result *models.SearchResult) error {
	now := time.Now()
	query := `INSERT INTO semantic_search_results (id, source, title, content, score, metadata, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`
	_, err := r.DB.ExecContext(ctx, query, result.ID, result.Source, result.Title, result.Content, result.Score, result.Metadata, now)
	return err
}

// IndexContent indexes content for semantic search.
func (r *SemanticSearchRepository) IndexContent(ctx context.Context, source, title, content, metadata string) error {
	now := time.Now()
	id := fmt.Sprintf("idx_%d", time.Now().UnixNano())

	metadataJSON, _ := json.Marshal(metadata)

	query := `INSERT INTO semantic_search_results (id, source, title, content, score, metadata, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`
	_, err := r.DB.ExecContext(ctx, query, id, source, title, content, 1.0, string(metadataJSON), now)
	return err
}

// EnsureSearchConfigTable creates the search_config table if it does not exist.
func (r *SemanticSearchRepository) EnsureSearchConfigTable(ctx context.Context) error {
	query := `
		CREATE TABLE IF NOT EXISTS semantic_search_config (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id VARCHAR(64) NOT NULL DEFAULT 'default' UNIQUE,
			hybrid_enabled BOOLEAN NOT NULL DEFAULT true,
			vector_weight DOUBLE PRECISION NOT NULL DEFAULT 0.6,
			keyword_weight DOUBLE PRECISION NOT NULL DEFAULT 0.4,
			rrf_enabled BOOLEAN NOT NULL DEFAULT true,
			rrf_k INTEGER NOT NULL DEFAULT 60,
			vector_top_k INTEGER NOT NULL DEFAULT 100,
			keyword_top_k INTEGER NOT NULL DEFAULT 100,
			min_score_threshold DOUBLE PRECISION NOT NULL DEFAULT 0.0,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		)`
	_, err := r.DB.ExecContext(ctx, query)
	return err
}

// UpsertSearchConfig inserts or updates the search configuration for a tenant.
func (r *SemanticSearchRepository) UpsertSearchConfig(ctx context.Context, config *models.SearchConfig) error {
	query := `
		INSERT INTO semantic_search_config (
			id, tenant_id, hybrid_enabled, vector_weight, keyword_weight,
			rrf_enabled, rrf_k, vector_top_k, keyword_top_k, min_score_threshold,
			created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		ON CONFLICT (tenant_id) DO UPDATE SET
			hybrid_enabled = EXCLUDED.hybrid_enabled,
			vector_weight = EXCLUDED.vector_weight,
			keyword_weight = EXCLUDED.keyword_weight,
			rrf_enabled = EXCLUDED.rrf_enabled,
			rrf_k = EXCLUDED.rrf_k,
			vector_top_k = EXCLUDED.vector_top_k,
			keyword_top_k = EXCLUDED.keyword_top_k,
			min_score_threshold = EXCLUDED.min_score_threshold,
			updated_at = NOW()`

	if config.ID == "" {
		config.ID = fmt.Sprintf("cfg_%d", time.Now().UnixNano())
	}
	if config.TenantID == "" {
		config.TenantID = "default"
	}

	now := time.Now()
	if config.CreatedAt.IsZero() {
		config.CreatedAt = now
	}
	config.UpdatedAt = now

	_, err := r.DB.ExecContext(ctx, query,
		config.ID, config.TenantID, config.HybridEnabled,
		config.VectorWeight, config.KeywordWeight,
		config.RRFEnabled, config.RRFK,
		config.VectorTopK, config.KeywordTopK,
		config.MinScoreThreshold,
		config.CreatedAt, now,
	)
	return err
}

// GetSearchConfig retrieves the search configuration for a tenant.
func (r *SemanticSearchRepository) GetSearchConfig(ctx context.Context, tenantID string) (*models.SearchConfig, error) {
	if tenantID == "" {
		tenantID = "default"
	}

	query := `
		SELECT id, tenant_id, hybrid_enabled, vector_weight, keyword_weight,
		       rrf_enabled, rrf_k, vector_top_k, keyword_top_k,
		       min_score_threshold, created_at, updated_at
		FROM semantic_search_config
		WHERE tenant_id = $1`

	var config models.SearchConfig
	err := r.DB.QueryRowContext(ctx, query, tenantID).Scan(
		&config.ID, &config.TenantID, &config.HybridEnabled,
		&config.VectorWeight, &config.KeywordWeight,
		&config.RRFEnabled, &config.RRFK,
		&config.VectorTopK, &config.KeywordTopK,
		&config.MinScoreThreshold,
		&config.CreatedAt, &config.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get search config: %w", err)
	}
	config.SetDefaults()
	return &config, nil
}

// KeywordSearch performs a text-based search using ILIKE patterns.
func (r *SemanticSearchRepository) KeywordSearch(ctx context.Context, query string, limit int) ([]models.SearchResult, error) {
	if limit <= 0 {
		limit = 10
	}
	pattern := "%" + query + "%"

	rows, err := r.DB.QueryContext(ctx,
		`SELECT id, source, title, content, score, metadata
		 FROM semantic_search_results
		 WHERE title ILIKE $1 OR content ILIKE $1
		 ORDER BY score DESC
		 LIMIT $2`,
		pattern, limit,
	)
	if err != nil {
		return nil, fmt.Errorf("keyword search: %w", err)
	}
	defer rows.Close()

	var results []models.SearchResult
	for rows.Next() {
		var r models.SearchResult
		var metadataStr sql.NullString
		if err := rows.Scan(&r.ID, &r.Source, &r.Title, &r.Content, &r.Score, &metadataStr); err != nil {
			return nil, fmt.Errorf("keyword scan: %w", err)
		}
		if metadataStr.Valid {
			r.Metadata = metadataStr.String
		}
		results = append(results, r)
	}
	return results, nil
}

func joinStrings(items []string, sep string) string {
	result := ""
	for i, item := range items {
		if i > 0 {
			result += sep
		}
		result += item
	}
	return result
}
