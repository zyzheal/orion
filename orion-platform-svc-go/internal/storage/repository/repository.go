package repository

import (
	"context"
	"fmt"
	"slices"
	"strings"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/storage/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// entryColumns lists the columns Update may set on storage_entries.
//
// Update did not filter anything at all: every key of the caller map was
// rendered into "UPDATE storage_entries SET <key>=$N WHERE id=$M AND
// tenant_id=$M+1", so id, tenant_id, created_at and a typo'd column were all
// spliced in. Because Postgres evaluates SET before WHERE, "SET id=$1 WHERE
// id=$2" could have rewritten the very primary key the statement was matching
// on and touched a different row.
//
// ErrStorageEntryNotFound is gone: it was a package-private-by-convention error
// the handler could not compare against, which is how PUT answered 500 for a
// missing entry. sentinel.NotFound is the canonical value the handler switches
// on.
var entryColumns = map[string]bool{
	"bucket":     true,
	"key":        true,
	"size":       true,
	"provider":   true,
	"updated_at": true,
}

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
//
// attrs is copied before it is mutated: the previous version stamped updated_at
// into the caller's map, so service.Update handed back a map that no longer
// described the request it was sent with.
func (r *Repository) Update(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.StorageEntry, error) {
	if len(attrs) == 0 {
		// Nothing to write is a caller bug, not a missing row: answering not
		// found here hid the mistake behind the handler's 404 branch.
		return nil, fmt.Errorf("%w: no fields to update", sentinel.BadRequest)
	}
	set := make(map[string]interface{}, len(attrs)+1)
	for k, v := range attrs {
		set[k] = v
	}
	keys := make([]string, 0, len(set))
	for k := range set {
		keys = append(keys, k)
	}
	slices.Sort(keys)
	for _, k := range keys {
		if !entryColumns[k] {
			return nil, fmt.Errorf("%w: column %q is not updatable on storage_entries", sentinel.BadRequest, k)
		}
	}
	set["updated_at"] = time.Now().UTC()
	keys = append(keys, "updated_at")
	slices.Sort(keys)

	setParts := make([]string, 0, len(keys))
	args := make([]interface{}, 0, len(keys)+2)
	for i, k := range keys {
		setParts = append(setParts, fmt.Sprintf("%s=$%d", k, i+1))
		args = append(args, set[k])
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf("UPDATE storage_entries SET %s WHERE id=$%d AND tenant_id=$%d",
		strings.Join(setParts, ", "), len(args)-1, len(args))
	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	n, err := result.RowsAffected()
	if err != nil {
		return nil, err
	}
	if n == 0 {
		return nil, sentinel.NotFound
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
