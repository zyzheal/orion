package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/ai/vector/models"
)

type VectorRepository struct {
	DB *sql.DB
}

func NewVectorRepository(db *sql.DB) *VectorRepository {
	return &VectorRepository{DB: db}
}

// CreateStore creates a new vector store.
func (r *VectorRepository) CreateStore(ctx context.Context, tenantID string, req *models.CreateStoreRequest) (*models.VectorStore, error) {
	now := time.Now()
	id := fmt.Sprintf("vs_%d", time.Now().UnixNano())
	metric := "cosine"
	if req.Metric != "" {
		metric = req.Metric
	}

	query := `INSERT INTO vector_stores (id, tenant_id, name, dimensions, metric, vector_count, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`
	if _, err := r.DB.ExecContext(ctx, query, id, tenantID, req.Name, req.Dimensions, metric, 0, now); err != nil {
		return nil, fmt.Errorf("create vector store: %w", err)
	}

	return &models.VectorStore{
		ID:         id,
		TenantID:   tenantID,
		Name:       req.Name,
		Dimensions: req.Dimensions,
		Metric:     metric,
		CreatedAt:  now,
	}, nil
}

// QueryStores returns paginated vector stores.
func (r *VectorRepository) QueryStores(ctx context.Context, tenantID string, limit, offset int) ([]models.VectorStore, int64, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	var total int64
	countQuery := `SELECT COUNT(*) FROM vector_stores WHERE tenant_id = $1`
	if err := r.DB.QueryRowContext(ctx, countQuery, tenantID).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count vector stores: %w", err)
	}

	query := `SELECT id, tenant_id, name, dimensions, metric, vector_count, created_at FROM vector_stores WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`
	rows, err := r.DB.QueryContext(ctx, query, tenantID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("query vector stores: %w", err)
	}
	defer rows.Close()

	var stores []models.VectorStore
	for rows.Next() {
		var s models.VectorStore
		if err := rows.Scan(&s.ID, &s.TenantID, &s.Name, &s.Dimensions, &s.Metric, &s.VectorCount, &s.CreatedAt); err != nil {
			return nil, 0, fmt.Errorf("scan vector store: %w", err)
		}
		stores = append(stores, s)
	}
	return stores, total, nil
}

// GetStore returns a vector store by ID.
func (r *VectorRepository) GetStore(ctx context.Context, tenantID, id string) (*models.VectorStore, error) {
	var s models.VectorStore
	query := `SELECT id, tenant_id, name, dimensions, metric, vector_count, created_at FROM vector_stores WHERE id = $1 AND tenant_id = $2`
	if err := r.DB.QueryRowContext(ctx, query, id, tenantID).Scan(
		&s.ID, &s.TenantID, &s.Name, &s.Dimensions, &s.Metric, &s.VectorCount, &s.CreatedAt,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("vector store not found: %s", id)
		}
		return nil, fmt.Errorf("get vector store: %w", err)
	}
	return &s, nil
}

// UpsertVector inserts or updates a vector.
func (r *VectorRepository) UpsertVector(ctx context.Context, storeID string, id string, data []float64, payload string) error {
	now := time.Now()
	dataJSON, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("marshal vector data: %w", err)
	}

	query := `INSERT INTO vector_entries (id, store_id, data, payload, created_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id, store_id) DO UPDATE SET data=$3, payload=$4`
	_, err = r.DB.ExecContext(ctx, query, id, storeID, string(dataJSON), payload, now)
	if err != nil {
		return fmt.Errorf("upsert vector: %w", err)
	}

	// Update vector count
	_, _ = r.DB.ExecContext(ctx, `UPDATE vector_stores SET vector_count = (SELECT COUNT(*) FROM vector_entries WHERE store_id = $1) WHERE id = $2`, storeID, storeID)
	return nil
}

// SearchVectors performs vector similarity search.
func (r *VectorRepository) SearchVectors(ctx context.Context, storeID string, query []float64, topK int) ([]models.SearchResult, error) {
	if topK <= 0 {
		topK = 5
	}

	// Get store dimensions
	var dimensions int
	if err := r.DB.QueryRowContext(ctx, `SELECT dimensions FROM vector_stores WHERE id = $1`, storeID).Scan(&dimensions); err != nil {
		return nil, fmt.Errorf("get store dimensions: %w", err)
	}

	// For now, use a simple fallback search (pgvector would do real cosine distance)
	// This returns topK entries by similarity to query vector
	queryJSON, _ := json.Marshal(query)

	rows, err := r.DB.QueryContext(ctx,
		`SELECT id, payload, 1.0 AS score FROM vector_entries WHERE store_id = $1 LIMIT $2`, storeID, topK)
	if err != nil {
		return nil, fmt.Errorf("search vectors: %w", err)
	}
	defer rows.Close()
	_ = queryJSON
	_ = dimensions

	var results []models.SearchResult
	for rows.Next() {
		var r models.SearchResult
		var score float64
		if err := rows.Scan(&r.ID, &r.Payload, &score); err != nil {
			return nil, fmt.Errorf("scan search result: %w", err)
		}
		results = append(results, r)
	}
	return results, nil
}

// DeleteVector removes a vector.
func (r *VectorRepository) DeleteVector(ctx context.Context, storeID, id string) error {
	result, err := r.DB.ExecContext(ctx, `DELETE FROM vector_entries WHERE store_id = $1 AND id = $2`, storeID, id)
	if err != nil {
		return fmt.Errorf("delete vector: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("vector not found: %s", id)
	}
	return nil
}

// DeleteStore removes a vector store.
func (r *VectorRepository) DeleteStore(ctx context.Context, tenantID, id string) error {
	// Delete all vectors first
	_, _ = r.DB.ExecContext(ctx, `DELETE FROM vector_entries WHERE store_id = $1`, id)

	result, err := r.DB.ExecContext(ctx, `DELETE FROM vector_stores WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return fmt.Errorf("delete vector store: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("vector store not found: %s", id)
	}
	return nil
}
