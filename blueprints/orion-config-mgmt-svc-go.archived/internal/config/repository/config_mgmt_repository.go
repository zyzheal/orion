package repository

import (
	"context"
	"orion/config-mgmt-svc-go/internal/config/models"

	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ==================== Config Items ====================

// Create inserts a new config item.
func (r *Repository) Create(ctx context.Context, c *models.ConfigItem) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO config_items (id, tenant_id, key, value, environment, version)
		 VALUES ($1,$2,$3,$4,$5,$6)`,
		c.ID, c.TenantID, c.Key, c.Value, c.Environment, c.Version)
	return err
}

// List returns a paginated list of config items for a tenant.
func (r *Repository) List(ctx context.Context, tenantID string, offset, limit int) ([]models.ConfigItem, error) {
	var items []models.ConfigItem
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM config_items WHERE tenant_id=$1 ORDER BY key OFFSET $2 LIMIT $3`,
		tenantID, offset, limit)
	return items, err
}

// GetByID returns a config item by its primary key.
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.ConfigItem, error) {
	var c models.ConfigItem
	err := r.db.GetContext(ctx, &c,
		`SELECT * FROM config_items WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

// GetByKey returns a config item by tenant, key, and optionally environment.
func (r *Repository) GetByKey(ctx context.Context, tenantID, key, environment string) (*models.ConfigItem, error) {
	var c models.ConfigItem
	if environment != "" {
		err := r.db.GetContext(ctx, &c,
			`SELECT * FROM config_items WHERE tenant_id=$1 AND key=$2 AND environment=$3`,
			tenantID, key, environment)
		if err != nil {
			return nil, err
		}
	} else {
		err := r.db.GetContext(ctx, &c,
			`SELECT * FROM config_items WHERE tenant_id=$1 AND key=$2 ORDER BY updated_at DESC LIMIT 1`,
			tenantID, key)
		if err != nil {
			return nil, err
		}
	}
	return &c, nil
}

// GetByEnvironment returns all config items for a tenant in a given environment.
func (r *Repository) GetByEnvironment(ctx context.Context, tenantID, environment string) ([]models.ConfigItem, error) {
	var items []models.ConfigItem
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM config_items WHERE tenant_id=$1 AND environment=$2 ORDER BY key`,
		tenantID, environment)
	return items, err
}

// Upsert creates or updates a config item, incrementing the version on conflict.
func (r *Repository) Upsert(ctx context.Context, c *models.ConfigItem) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO config_items (id, tenant_id, key, value, environment, version)
		 VALUES ($1,$2,$3,$4,$5,1)
		 ON CONFLICT (tenant_id, key, environment) DO UPDATE
		 SET value=$4, version=config_items.version+1, updated_at=NOW()
		 WHERE config_items.tenant_id=$2 AND config_items.key=$3 AND config_items.environment=$5`,
		c.ID, c.TenantID, c.Key, c.Value, c.Environment)
	return err
}

// Update modifies the value of an existing config item and increments its version.
func (r *Repository) Update(ctx context.Context, c *models.ConfigItem) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE config_items SET value=$1, version=version+1, updated_at=NOW()
		 WHERE id=$2 AND tenant_id=$3`,
		c.Value, c.ID, c.TenantID)
	return err
}

// Delete removes a config item by id.
func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM config_items WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// DeleteByKey removes a config item by tenant, key, and environment.
func (r *Repository) DeleteByKey(ctx context.Context, tenantID, key, environment string) error {
	if environment != "" {
		_, err := r.db.ExecContext(ctx,
			`DELETE FROM config_items WHERE tenant_id=$1 AND key=$2 AND environment=$3`,
			tenantID, key, environment)
		return err
	}
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM config_items WHERE tenant_id=$1 AND key=$2`,
		tenantID, key)
	return err
}

// Count returns the total number of config items for a tenant.
func (r *Repository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM config_items WHERE tenant_id=$1`, tenantID)
	return count, err
}

// GetAll returns all config items for a tenant (no pagination).
func (r *Repository) GetAll(ctx context.Context, tenantID string) ([]models.ConfigItem, error) {
	var items []models.ConfigItem
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM config_items WHERE tenant_id=$1 ORDER BY key`,
		tenantID)
	return items, err
}

// ==================== Config Versions ====================

// SaveVersion inserts a new version record for a config item.
func (r *Repository) SaveVersion(ctx context.Context, v *models.ConfigVersion) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO config_versions
		 (id, tenant_id, config_id, config_key, environment, value, version_number, change_type, changed_by, change_reason)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		v.ID, v.TenantID, v.ConfigID, v.ConfigKey, v.Environment,
		v.Value, v.VersionNumber, v.ChangeType, v.ChangedBy, v.ChangeReason)
	return err
}

// GetVersions returns version history for a config item, ordered by version descending.
func (r *Repository) GetVersions(ctx context.Context, tenantID, configID string, limit int) ([]models.ConfigVersion, error) {
	var versions []models.ConfigVersion
	err := r.db.SelectContext(ctx, &versions,
		`SELECT * FROM config_versions
		 WHERE tenant_id=$1 AND config_id=$2
		 ORDER BY version_number DESC LIMIT $3`,
		tenantID, configID, limit)
	return versions, err
}

// GetVersionsByKey returns version history by tenant and config key.
func (r *Repository) GetVersionsByKey(ctx context.Context, tenantID, key, environment string, limit int) ([]models.ConfigVersion, error) {
	var versions []models.ConfigVersion
	if environment != "" {
		err := r.db.SelectContext(ctx, &versions,
			`SELECT * FROM config_versions
			 WHERE tenant_id=$1 AND config_key=$2 AND environment=$3
			 ORDER BY version_number DESC LIMIT $4`,
			tenantID, key, environment, limit)
		return versions, err
	}
	err := r.db.SelectContext(ctx, &versions,
		`SELECT * FROM config_versions
		 WHERE tenant_id=$1 AND config_key=$2
		 ORDER BY version_number DESC LIMIT $3`,
		tenantID, key, limit)
	return versions, err
}

// GetVersionByID returns a single version record by its ID and tenant.
func (r *Repository) GetVersionByID(ctx context.Context, tenantID, id string) (*models.ConfigVersion, error) {
	var v models.ConfigVersion
	err := r.db.GetContext(ctx, &v,
		`SELECT * FROM config_versions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &v, nil
}
