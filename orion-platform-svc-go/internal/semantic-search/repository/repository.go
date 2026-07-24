package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/semantic-search/models"
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
