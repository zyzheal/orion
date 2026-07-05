package repository

import (
	"context"
	"fmt"

	"orion/tenant-svc/internal/models"
	"orion/go-common/pkg/database"
)

// TenantRepository provides data access for tenant entities.
type TenantRepository struct {
	database.BaseRepository
}

func NewTenantRepository(db *database.DB) *TenantRepository {
	return &TenantRepository{
		BaseRepository: database.NewBaseRepository(db),
	}
}

func (r *TenantRepository) Create(ctx context.Context, tenant *models.Tenant) error {
	query := `
		INSERT INTO tenants (id, name, display_name, status, quota_users, quota_storage_mb)
		VALUES ($1, $2, $3, $4, $5, $6) RETURNING created_at, updated_at
	`
	err := r.DB().QueryRowContext(ctx, query,
		tenant.ID, tenant.Name, tenant.DisplayName, tenant.Status,
		tenant.QuotaUsers, tenant.QuotaStorageMB,
	).Scan(&tenant.CreatedAt, &tenant.UpdatedAt)
	return err
}

func (r *TenantRepository) GetByID(ctx context.Context, id string) (*models.Tenant, error) {
	var tenant models.Tenant
	query := `SELECT id, name, display_name, status, quota_users, quota_storage_mb, created_at, updated_at FROM tenants WHERE id = $1`
	err := r.DB().GetContext(ctx, &tenant, query, id)
	if err != nil {
		return nil, fmt.Errorf("tenant not found: %w", err)
	}
	return &tenant, nil
}

func (r *TenantRepository) GetByName(ctx context.Context, name string) (*models.Tenant, error) {
	var tenant models.Tenant
	query := `SELECT id, name, display_name, status, quota_users, quota_storage_mb, created_at, updated_at FROM tenants WHERE name = $1`
	err := r.DB().GetContext(ctx, &tenant, query, name)
	if err != nil {
		return nil, fmt.Errorf("tenant not found: %w", err)
	}
	return &tenant, nil
}

func (r *TenantRepository) List(ctx context.Context, offset, limit int) ([]models.Tenant, error) {
	var tenants []models.Tenant
	query := `SELECT id, name, display_name, status, quota_users, quota_storage_mb, created_at, updated_at FROM tenants ORDER BY created_at DESC LIMIT $1 OFFSET $2`
	err := r.DB().SelectContext(ctx, &tenants, query, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to list tenants: %w", err)
	}
	return tenants, nil
}

func (r *TenantRepository) Count(ctx context.Context) (int, error) {
	var count int
	err := r.DB().GetContext(ctx, &count, "SELECT COUNT(*) FROM tenants WHERE status != 'deleted'")
	return count, err
}

func (r *TenantRepository) Update(ctx context.Context, tenant *models.Tenant) error {
	query := `
		UPDATE tenants SET name = $1, display_name = $2, status = $3,
			quota_users = $4, quota_storage_mb = $5, updated_at = now()
		WHERE id = $6
	`
	_, err := r.DB().ExecContext(ctx, query,
		tenant.Name, tenant.DisplayName, tenant.Status,
		tenant.QuotaUsers, tenant.QuotaStorageMB, tenant.ID,
	)
	return err
}

func (r *TenantRepository) UpdateSettings(ctx context.Context, id, displayName string) error {
	_, err := r.DB().ExecContext(ctx,
		"UPDATE tenants SET display_name = $1, updated_at = now() WHERE id = $2",
		displayName, id)
	return err
}

// Exists delegates to BaseRepository.
func (r *TenantRepository) Exists(ctx context.Context, id string) (bool, error) {
	return r.BaseRepository.Exists(ctx, "tenants", "id = $1", id)
}

// UpdateStatus updates tenant status directly (tenants table has no tenant_id column).
func (r *TenantRepository) UpdateStatus(ctx context.Context, id, status string) error {
	_, err := r.DB().ExecContext(ctx,
		"UPDATE tenants SET status = $1, updated_at = now() WHERE id = $2",
		status, id)
	return err
}

// SoftDelete soft-deletes a tenant directly (tenants table has no tenant_id column).
func (r *TenantRepository) SoftDelete(ctx context.Context, id string) error {
	_, err := r.DB().ExecContext(ctx,
		"UPDATE tenants SET status = 'deleted', updated_at = now() WHERE id = $1", id)
	return err
}
