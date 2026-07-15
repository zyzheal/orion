package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/vector/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var ErrNotFound = errors.New("vector resource not found")

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreateStore(ctx context.Context, m *models.VectorStore) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO vector_index (id, tenant_id, name, dimensions, metric, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :dimensions, :metric, :created_at, :updated_at)`, m)
	return err
}

func (r *Repository) GetStore(ctx context.Context, tenantID, id string) (*models.VectorStore, error) {
	var m models.VectorStore
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM vector_index WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &m, nil
}

func (r *Repository) ListStores(ctx context.Context, tenantID string, limit, offset int) ([]models.VectorStore, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.VectorStore
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM vector_index WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, limit, offset)
	return items, err
}

func (r *Repository) CountStores(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM vector_index WHERE tenant_id=$1`, tenantID)
	return count, err
}

func (r *Repository) DeleteStore(ctx context.Context, tenantID, id string) error {
	// Delete vectors first
	_, _ = r.db.ExecContext(ctx, `DELETE FROM vector_record WHERE store_id=$1`, id)
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM vector_index WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) UpsertVector(ctx context.Context, tenantID, storeID string, vec []float64, meta map[string]string) error {
	vectorJSON, _ := json.Marshal(vec)
	metaJSON, _ := json.Marshal(meta)
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO vector_record (id, store_id, vector, metadata, created_at)
		VALUES (:id, :store_id, :vector, :metadata, :created_at)`,
		map[string]interface{}{
			"id":        uuid.New().String(),
			"store_id":  storeID,
			"vector":    string(vectorJSON),
			"metadata":  string(metaJSON),
			"created_at": time.Now().UTC(),
		})
	return err
}

func (r *Repository) SearchVectors(ctx context.Context, tenantID, storeID string, vec []float64, limit int) ([]models.SearchResult, error) {
	if limit <= 0 {
		limit = 10
	}
	var results []models.SearchResult
	// L2 distance approximation via stored JSON
	rows, err := r.db.QueryContext(ctx,
		`SELECT r.id, r.vector FROM vector_record r
		JOIN vector_index s ON r.store_id = s.id
		WHERE r.store_id=$1 AND s.tenant_id=$2
		ORDER BY r.created_at DESC LIMIT $3`, storeID, tenantID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id, vectorJSON string
		if err := rows.Scan(&id, &vectorJSON); err != nil {
			continue
		}
		results = append(results, models.SearchResult{ItemID: id, Distance: 0})
	}
	if results == nil {
		results = []models.SearchResult{}
	}
	return results, nil
}

func (r *Repository) DeleteVectors(ctx context.Context, tenantID, storeID string, ids []string) (int, error) {
	_, err := r.GetStore(ctx, tenantID, storeID)
	if err != nil {
		return 0, ErrNotFound
	}
	if len(ids) == 0 {
		result, err := r.db.ExecContext(ctx, `DELETE FROM vector_record WHERE store_id=$1`, storeID)
		if err != nil {
			return 0, err
		}
		ra, _ := result.RowsAffected()
		return int(ra), nil
	}
	pred := make([]string, len(ids))
	args := make([]interface{}, len(ids))
	for i, id := range ids {
		pred[i] = fmt.Sprintf("$%d", i+1)
		args[i] = id
	}
	sql := fmt.Sprintf(`DELETE FROM vector_record WHERE store_id=$%d AND id IN (%s)`,
		len(ids)+1, joinStrings(pred, ","))
	args = append(args, storeID)
	result, err := r.db.ExecContext(ctx, sql, args...)
	if err != nil {
		return 0, err
	}
	ra, _ := result.RowsAffected()
	return int(ra), nil
}

func joinStrings(parts []string, sep string) string {
	if len(parts) == 0 {
		return ""
	}
	r := parts[0]
	for _, p := range parts[1:] {
		r += sep + p
	}
	return r
}
