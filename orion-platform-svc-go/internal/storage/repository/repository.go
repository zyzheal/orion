package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/storage/models"

	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var ErrStorageEntryNotFound = errors.New("storage entry not found")

// Repository handles persistent storage entry metadata.
type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// Create inserts a new storage entry.
func (r *Repository) Create(ctx context.Context, entity *models.StorageEntry) error {
	entity.ID = uuid.New().String()
	now := time.Now().UTC()
	entity.CreatedAt = now
	entity.UpdatedAt = now

	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO storage_entries (id, tenant_id, bucket, key, size, provider, created_at, updated_at)
		 VALUES (:id, :tenantId, :bucket, :key, :size, :provider, :createdAt, :updatedAt)`,
		entity)
	return err
}

// GetByID retrieves a storage entry by ID.
func (r *Repository) GetByID(ctx context.Context, id, tenantID string) (*models.StorageEntry, error) {
	var entity models.StorageEntry
	err := r.db.GetContext(ctx, &entity,
		`SELECT * FROM storage_entries WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &entity, nil
}

// GetByBucketAndKey retrieves a storage entry by bucket and key.
func (r *Repository) GetByBucketAndKey(ctx context.Context, bucket, key, tenantID string) (*models.StorageEntry, error) {
	var entity models.StorageEntry
	err := r.db.GetContext(ctx, &entity,
		`SELECT * FROM storage_entries WHERE bucket=$1 AND key=$2 AND tenant_id=$3`, bucket, key, tenantID)
	if err != nil {
		return nil, err
	}
	return &entity, nil
}

// List retrieves all storage entries for a tenant.
func (r *Repository) List(ctx context.Context, tenantID string, limit, offset int) ([]models.StorageEntry, error) {
	var entities []models.StorageEntry
	err := r.db.SelectContext(ctx, &entities,
		`SELECT * FROM storage_entries WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
		tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return entities, nil
}

// Update modifies an existing storage entry.
func (r *Repository) Update(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.StorageEntry, error) {
	if len(attrs) == 0 {
		return nil, sentinel.NotFound
	}
	attrs["updated_at"] = time.Now().UTC()
	set := make([]string, 0, len(attrs))
	args := make([]interface{}, 0, len(attrs)+2)
	i := 1
	for k, v := range attrs {
		set = append(set, fmt.Sprintf("%s=$%d", k, i))
		attrs[k] = v
		args = append(args, v)
		i++
	}
	idIdx := i
	tenantIdx := i + 1
	args = append(args, id, tenantID)
	query := fmt.Sprintf("UPDATE storage_entries SET %s WHERE id=$%d AND tenant_id=$%d",
		strings.Join(set, ", "), idIdx, tenantIdx)
	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return nil, ErrStorageEntryNotFound
	}
	return r.GetByID(ctx, id, tenantID)
}

// Delete removes a storage entry.
func (r *Repository) Delete(ctx context.Context, id, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM storage_entries WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

// DeleteByBucketAndKey removes a storage entry by bucket and key.
func (r *Repository) DeleteByBucketAndKey(ctx context.Context, bucket, key, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM storage_entries WHERE bucket=$1 AND key=$2 AND tenant_id=$3`, bucket, key, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}
