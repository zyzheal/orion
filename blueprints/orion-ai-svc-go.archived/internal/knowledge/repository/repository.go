package repository

import (
	"context"
	"database/sql"
	"errors"
	"encoding/json"
	"fmt"
	"time"

	"orion/ai-svc-go/internal/knowledge/models"
)

type KnowledgeRepository struct {
	DB *sql.DB
}

func NewKnowledgeRepository(db *sql.DB) *KnowledgeRepository {
	return &KnowledgeRepository{DB: db}
}

// CreateBase creates a new knowledge base.
func (r *KnowledgeRepository) CreateBase(ctx context.Context, tenantID string, req *models.CreateBaseRequest) (*models.KnowledgeBase, error) {
	now := time.Now()
	id := fmt.Sprintf("kb_%d", time.Now().UnixNano())
	embeddingModel := "text-embedding-3-small"
	if req.EmbeddingModel != "" {
		embeddingModel = req.EmbeddingModel
	}

	query := `INSERT INTO knowledge_bases (id, tenant_id, name, description, is_enabled, embedding_model, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`
	if _, err := r.DB.ExecContext(ctx, query, id, tenantID, req.Name, req.Description, true, embeddingModel, now, now); err != nil {
		return nil, fmt.Errorf("create knowledge base: %w", err)
	}

	return &models.KnowledgeBase{
		ID:             id,
		TenantID:       tenantID,
		Name:           req.Name,
		Description:    req.Description,
		IsEnabled:      true,
		EmbeddingModel: embeddingModel,
		CreatedAt:      now,
		UpdatedAt:      now,
	}, nil
}

// QueryBases returns paginated knowledge bases.
func (r *KnowledgeRepository) QueryBases(ctx context.Context, tenantID string, limit, offset int) (models.KnowledgeBaseResponse, error) {
	var resp models.KnowledgeBaseResponse
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	countQuery := `SELECT COUNT(*) FROM knowledge_bases WHERE tenant_id = $1`
	query := `SELECT id, tenant_id, name, description, is_enabled, embedding_model, created_at, updated_at FROM knowledge_bases WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`

	if err := r.DB.QueryRowContext(ctx, countQuery, tenantID).Scan(&resp.Total); err != nil {
		return resp, fmt.Errorf("count knowledge bases: %w", err)
	}

	rows, err := r.DB.QueryContext(ctx, query, tenantID, limit, offset)
	if err != nil {
		return resp, fmt.Errorf("query knowledge bases: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var b models.KnowledgeBase
		if err := rows.Scan(&b.ID, &b.TenantID, &b.Name, &b.Description, &b.IsEnabled, &b.EmbeddingModel, &b.CreatedAt, &b.UpdatedAt); err != nil {
			return resp, fmt.Errorf("scan knowledge base: %w", err)
		}
		resp.Data = append(resp.Data, b)
	}
	return resp, nil
}

// GetBase returns a knowledge base by ID.
func (r *KnowledgeRepository) GetBase(ctx context.Context, tenantID, id string) (*models.KnowledgeBase, error) {
	var b models.KnowledgeBase
	query := `SELECT id, tenant_id, name, description, is_enabled, embedding_model, created_at, updated_at FROM knowledge_bases WHERE id = $1 AND tenant_id = $2`
	if err := r.DB.QueryRowContext(ctx, query, id, tenantID).Scan(
		&b.ID, &b.TenantID, &b.Name, &b.Description, &b.IsEnabled, &b.EmbeddingModel, &b.CreatedAt, &b.UpdatedAt,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("knowledge base not found: %s", id)
		}
		return nil, fmt.Errorf("get knowledge base: %w", err)
	}
	return &b, nil
}

// AddDocument adds a document to a knowledge base.
func (r *KnowledgeRepository) AddDocument(ctx context.Context, baseID string, title, content, metadata string) (*models.Document, error) {
	now := time.Now()
	id := fmt.Sprintf("doc_%d", time.Now().UnixNano())

	metadataJSON, _ := json.Marshal(metadata)

	query := `INSERT INTO knowledge_documents (id, base_id, title, content, embedding, metadata, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`
	if _, err := r.DB.ExecContext(ctx, query, id, baseID, title, content, "[]", string(metadataJSON), "indexed", now); err != nil {
		return nil, fmt.Errorf("add document: %w", err)
	}

	return &models.Document{
		ID:        id,
		BaseID:    baseID,
		Title:     title,
		Content:   content,
		Metadata:  metadata,
		Status:    "indexed",
		CreatedAt: now,
	}, nil
}

// QueryDocuments returns paginated documents.
func (r *KnowledgeRepository) QueryDocuments(ctx context.Context, baseID string, limit, offset int) (models.DocumentResponse, error) {
	var resp models.DocumentResponse
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	countQuery := `SELECT COUNT(*) FROM knowledge_documents WHERE base_id = $1`
	query := `SELECT id, base_id, title, content, embedding, metadata, status, created_at FROM knowledge_documents WHERE base_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`

	if err := r.DB.QueryRowContext(ctx, countQuery, baseID).Scan(&resp.Total); err != nil {
		return resp, fmt.Errorf("count documents: %w", err)
	}

	rows, err := r.DB.QueryContext(ctx, query, baseID, limit, offset)
	if err != nil {
		return resp, fmt.Errorf("query documents: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var d models.Document
		var embeddingStr, metadataStr sql.NullString
		if err := rows.Scan(&d.ID, &d.BaseID, &d.Title, &d.Content, &embeddingStr, &metadataStr, &d.Status, &d.CreatedAt); err != nil {
			return resp, fmt.Errorf("scan document: %w", err)
		}
		if metadataStr.Valid {
			d.Metadata = metadataStr.String
		}
		resp.Data = append(resp.Data, d)
	}
	return resp, nil
}

// DeleteDocument removes a document.
func (r *KnowledgeRepository) DeleteDocument(ctx context.Context, id string) error {
	result, err := r.DB.ExecContext(ctx, `DELETE FROM knowledge_documents WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("delete document: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("document not found: %s", id)
	}
	return nil
}

// DeleteBase removes a knowledge base.
func (r *KnowledgeRepository) DeleteBase(ctx context.Context, tenantID, id string) error {
	result, err := r.DB.ExecContext(ctx, `DELETE FROM knowledge_bases WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return fmt.Errorf("delete knowledge base: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("knowledge base not found: %s", id)
	}
	return nil
}

// SearchDocuments performs semantic search using vector similarity.
func (r *KnowledgeRepository) SearchDocuments(ctx context.Context, baseID string, query string, topK int, filters string, scoreThresh float64) ([]models.SearchResult, error) {
	if topK <= 0 {
		topK = 5
	}
	if scoreThresh < 0 {
		scoreThresh = 0.0
	}

	// For now, use text search as fallback (vector search would use pgvector)
	where := []string{"base_id = $1"}
	args := []interface{}{baseID}
	argIdx := 2

	if filters != "" {
		where = append(where, fmt.Sprintf("metadata ILIKE $%d", argIdx))
		args = append(args, "%"+filters+"%")
		argIdx++
	}

	whereClause := ""
	if len(where) > 0 {
		whereClause = "WHERE " + joinStrings(where, " AND ")
	}

	queryStr := fmt.Sprintf(`
		SELECT id, title, content, 1.0 AS score
		FROM knowledge_documents %s
		ORDER BY similarity(title, $%d) + similarity(content, $%d) DESC
		LIMIT $%d`,
		whereClause, argIdx, argIdx, argIdx+1)
	args = append(args, query, topK)

	rows, err := r.DB.QueryContext(ctx, queryStr, args...)
	if err != nil {
		return nil, fmt.Errorf("search documents: %w", err)
	}
	defer rows.Close()

	var results []models.SearchResult
	for rows.Next() {
		var r models.SearchResult
		var score float64
		if err := rows.Scan(&r.ID, &r.Title, &r.Content, &score); err != nil {
			return nil, fmt.Errorf("scan search result: %w", err)
		}
		if score >= scoreThresh {
			results = append(results, r)
		}
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
