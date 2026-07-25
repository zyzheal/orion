package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/file-handler/models"
	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var (
	ErrFileNotFound       = errors.New("file not found")
	ErrStorageBackendNotFound = errors.New("storage backend not found")
)

// Repository handles persistent file and storage backend metadata.
type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- FileRecord CRUD ---

// CreateFile inserts a new file record.
func (r *Repository) CreateFile(ctx context.Context, f *models.FileRecord) error {
	f.ID = uuid.New().String()
	now := time.Now().UTC()
	f.CreatedAt = now
	f.UpdatedAt = now
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO file_records (id, tenant_id, name, original_name, type, extension, size,
		   storage_type, storage_path, bucket, category, owner, visibility, tags, created_at, updated_at)
		 VALUES (:id, :tenantId, :name, :originalName, :type, :extension, :size,
		   :storageType, :storagePath, :bucket, :category, :owner, :visibility, :tags, :createdAt, :updatedAt)`,
		f)
	return err
}

// GetFileByID retrieves a file record by ID and tenant.
func (r *Repository) GetFileByID(ctx context.Context, id, tenantID string) (*models.FileRecord, error) {
	var f models.FileRecord
	err := r.db.GetContext(ctx, &f,
		`SELECT * FROM file_records WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &f, nil
}

// GetFileByStoragePath retrieves a file record by tenant and storage path.
func (r *Repository) GetFileByStoragePath(ctx context.Context, tenantID, storagePath string) (*models.FileRecord, error) {
	var f models.FileRecord
	err := r.db.GetContext(ctx, &f,
		`SELECT * FROM file_records WHERE storage_path=$1 AND tenant_id=$2`, storagePath, tenantID)
	if err != nil {
		return nil, err
	}
	return &f, nil
}

// ListFiles lists file records for a tenant with optional category filter.
func (r *Repository) ListFiles(ctx context.Context, tenantID, category string, limit, offset int) ([]models.FileRecord, error) {
	var files []models.FileRecord
	query := `SELECT * FROM file_records WHERE tenant_id=$1`
	args := []interface{}{tenantID}
	argIdx := 2
	if category != "" {
		query += fmt.Sprintf(" AND category=$%d", argIdx)
		args = append(args, category)
		argIdx++
	}
	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, limit, offset)
	if err := r.db.SelectContext(ctx, &files, query, args...); err != nil {
		return nil, err
	}
	return files, nil
}

// UpdateFile updates a file record's attributes.
func (r *Repository) UpdateFile(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.FileRecord, error) {
	if len(attrs) == 0 {
		return nil, sentinel.NotFound
	}
	attrs["updated_at"] = time.Now().UTC()
	set := make([]string, 0, len(attrs))
	args := make([]interface{}, 0, len(attrs)+2)
	i := 1
	for k, v := range attrs {
		set = append(set, fmt.Sprintf("%s=$%d", k, i))
		args = append(args, v)
		i++
	}
	idIdx := i
	tenantIdx := i + 1
	args = append(args, id, tenantID)
	query := fmt.Sprintf("UPDATE file_records SET %s WHERE id=$%d AND tenant_id=$%d",
		strings.Join(set, ", "), idIdx, tenantIdx)
	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return nil, ErrFileNotFound
	}
	return r.GetFileByID(ctx, id, tenantID)
}

// DeleteFile removes a file record.
func (r *Repository) DeleteFile(ctx context.Context, id, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM file_records WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

// --- StorageBackend CRUD ---

// CreateBackend inserts a new storage backend.
func (r *Repository) CreateBackend(ctx context.Context, b *models.StorageBackend) error {
	b.ID = uuid.New().String()
	now := time.Now().UTC()
	b.CreatedAt = now
	b.UpdatedAt = now
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO storage_backends (id, tenant_id, name, type, config, enabled, created_at, updated_at)
		 VALUES (:id, :tenantId, :name, :type, :config, :enabled, :createdAt, :updatedAt)`,
		b)
	return err
}

// GetBackendByID retrieves a storage backend by ID and tenant.
func (r *Repository) GetBackendByID(ctx context.Context, id, tenantID string) (*models.StorageBackend, error) {
	var b models.StorageBackend
	err := r.db.GetContext(ctx, &b,
		`SELECT * FROM storage_backends WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

// GetBackendByName retrieves a storage backend by name and tenant.
func (r *Repository) GetBackendByName(ctx context.Context, name, tenantID string) (*models.StorageBackend, error) {
	var b models.StorageBackend
	err := r.db.GetContext(ctx, &b,
		`SELECT * FROM storage_backends WHERE name=$1 AND tenant_id=$2 AND enabled=true`, name, tenantID)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

// ListBackends lists enabled storage backends for a tenant.
func (r *Repository) ListBackends(ctx context.Context, tenantID string) ([]models.StorageBackend, error) {
	var backends []models.StorageBackend
	err := r.db.SelectContext(ctx, &backends,
		`SELECT * FROM storage_backends WHERE tenant_id=$1 AND enabled=true ORDER BY created_at ASC`, tenantID)
	if err != nil {
		return nil, err
	}
	return backends, nil
}

// UpdateBackend updates a storage backend's attributes.
func (r *Repository) UpdateBackend(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.StorageBackend, error) {
	if len(attrs) == 0 {
		return nil, sentinel.NotFound
	}
	attrs["updated_at"] = time.Now().UTC()
	set := make([]string, 0, len(attrs))
	args := make([]interface{}, 0, len(attrs)+2)
	i := 1
	for k, v := range attrs {
		set = append(set, fmt.Sprintf("%s=$%d", k, i))
		args = append(args, v)
		i++
	}
	idIdx := i
	tenantIdx := i + 1
	args = append(args, id, tenantID)
	query := fmt.Sprintf("UPDATE storage_backends SET %s WHERE id=$%d AND tenant_id=$%d",
		strings.Join(set, ", "), idIdx, tenantIdx)
	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return nil, ErrStorageBackendNotFound
	}
	return r.GetBackendByID(ctx, id, tenantID)
}

// DeleteBackend removes a storage backend.
func (r *Repository) DeleteBackend(ctx context.Context, id, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM storage_backends WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}
