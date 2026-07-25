package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/cmdb-collector/models"

	"github.com/google/uuid"
)

// factoryRepoErrors are the canonical errors returned by the factory repository.
var (
	ErrAdapterFactoryNotFound = errors.New("adapter not found")
	ErrAdapterNotUnique       = errors.New("duplicate adapter key")
	ErrDiscoveryJobNotFound   = errors.New("discovery job not found")
	ErrAssetNotFound          = errors.New("asset not found")
)

// ===========================================================================
// Adapter CRUD
// ===========================================================================

// CreateAdapter inserts a new CMDBAdapter.  Generates a UUID for id.
func (r *Repository) CreateAdapter(ctx context.Context, a *models.CMDBAdapter) error {
	if a.ID == "" {
		a.ID = uuid.New().String()
	}
	now := time.Now().UTC()
	a.CreatedAt = now
	a.UpdatedAt = now

	_, err := r.db.ExecContext(ctx,
		`INSERT INTO cmdb_adapters
			(id, tenant_id, name, category, vendor, description, config, enabled, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		a.ID, a.TenantID, a.Name, a.Category, a.Vendor, a.Description,
		a.Config, a.Enabled, a.CreatedAt, a.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("create adapter: %w", err)
	}
	return nil
}

// GetAdapter returns the CMDBAdapter with the given id, scoped by tenant.
func (r *Repository) GetAdapter(ctx context.Context, tenantID, id string) (*models.CMDBAdapter, error) {
	var a models.CMDBAdapter
	err := r.db.GetContext(ctx, &a,
		`SELECT id, tenant_id, name, category, vendor, description, config,
		        enabled, created_at, updated_at
		 FROM cmdb_adapters
		 WHERE id = $1 AND tenant_id = $2`,
		id, tenantID,
	)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// GetAdapterByName returns the CMDBAdapter by name, scoped by tenant.
func (r *Repository) GetAdapterByName(ctx context.Context, tenantID, name string) (*models.CMDBAdapter, error) {
	var a models.CMDBAdapter
	err := r.db.GetContext(ctx, &a,
		`SELECT id, tenant_id, name, category, vendor, description, config,
		        enabled, created_at, updated_at
		 FROM cmdb_adapters
		 WHERE name = $1 AND tenant_id = $2`,
		name, tenantID,
	)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// ListAdapters returns adapters for a tenant, optionally filtered by category
// and enabled state.
func (r *Repository) ListAdapters(ctx context.Context, tenantID, category string, enabled *bool, offset, limit int) ([]models.CMDBAdapter, error) {
	var items []models.CMDBAdapter

	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argOffset := 2

	if category != "" {
		where += " AND category = $" + fmt.Sprintf("%d", argOffset)
		args = append(args, category)
		argOffset++
	}
	if enabled != nil {
		where += " AND enabled = $" + fmt.Sprintf("%d", argOffset)
		args = append(args, *enabled)
		argOffset++
	}
	offsetArg := fmt.Sprintf("$%d", len(args)+1)
	limitArg := fmt.Sprintf("$%d", len(args)+2)
	args = append(args, offset, limit)

	query := `SELECT id, tenant_id, name, category, vendor, description, config,
		        enabled, created_at, updated_at
			 FROM cmdb_adapters ` + where +
		` ORDER BY created_at DESC OFFSET ` + offsetArg + ` LIMIT ` + limitArg

	err := r.db.SelectContext(ctx, &items, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list adapters: %w", err)
	}
	return items, nil
}

// UpdateAdapter updates a CMDBAdapter by id, scoped by tenant.
func (r *Repository) UpdateAdapter(ctx context.Context, a *models.CMDBAdapter) error {
	a.UpdatedAt = time.Now().UTC()

	res, err := r.db.ExecContext(ctx,
		`UPDATE cmdb_adapters
		   SET name = $1, category = $2, vendor = $3, description = $4,
		       config = $5, enabled = $6, updated_at = $7
		 WHERE id = $8 AND tenant_id = $9`,
		a.Name, a.Category, a.Vendor, a.Description, a.Config, a.Enabled,
		a.UpdatedAt, a.ID, a.TenantID,
	)
	if err != nil {
		return fmt.Errorf("update adapter: %w", err)
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return ErrAdapterFactoryNotFound
	}
	return nil
}

// DeleteAdapter hard-deletes a CMDBAdapter, scoped by tenant.
func (r *Repository) DeleteAdapter(ctx context.Context, tenantID, id string) error {
	res, err := r.db.ExecContext(ctx,
		`DELETE FROM cmdb_adapters WHERE id = $1 AND tenant_id = $2`, id, tenantID,
	)
	if err != nil {
		return fmt.Errorf("delete adapter: %w", err)
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return ErrAdapterFactoryNotFound
	}
	return nil
}

// CountAdapters returns the number of adapters for a tenant.
func (r *Repository) CountAdapters(ctx context.Context, tenantID string) (int, error) {
	var n int
	err := r.db.GetContext(ctx, &n,
		`SELECT COUNT(*) FROM cmdb_adapters WHERE tenant_id = $1`, tenantID,
	)
	return n, err
}

// ===========================================================================
// DiscoveryJob CRUD
// ===========================================================================

// CreateJob inserts a new CMDBDiscoveryJob with status="pending".
func (r *Repository) CreateJob(ctx context.Context, j *models.CMDBDiscoveryJob) error {
	if j.ID == "" {
		j.ID = uuid.New().String()
	}
	now := time.Now().UTC()
	j.CreatedAt = now
	if j.Status == "" {
		j.Status = "pending"
	}

	_, err := r.db.ExecContext(ctx,
		`INSERT INTO cmdb_discovery_jobs
			(id, tenant_id, adapter_id, target, status, result_count, error,
			 started_at, finished_at, created_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		j.ID, j.TenantID, j.AdapterID, j.Target, j.Status, j.ResultCount,
		j.Error, j.StartedAt, j.FinishedAt, j.CreatedAt,
	)
	return err
}

// GetJob returns the job with the given id, scoped by tenant.
func (r *Repository) GetJob(ctx context.Context, tenantID, id string) (*models.CMDBDiscoveryJob, error) {
	var j models.CMDBDiscoveryJob
	err := r.db.GetContext(ctx, &j,
		`SELECT id, tenant_id, adapter_id, target, status, result_count, error,
		        started_at, finished_at, created_at
		 FROM cmdb_discovery_jobs
		 WHERE id = $1 AND tenant_id = $2`,
		id, tenantID,
	)
	if err != nil {
		return nil, err
	}
	return &j, nil
}

// ListJobs returns paginated jobs for a tenant, optionally filtered by status
// or adapter.
func (r *Repository) ListJobs(ctx context.Context, tenantID, adapterID, status string, offset, limit int) ([]models.CMDBDiscoveryJob, error) {
	var items []models.CMDBDiscoveryJob

	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argOffset := 2

	switch {
	case adapterID != "" && status != "":
		where += " AND adapter_id = $" + fmt.Sprintf("%d", argOffset) + " AND status = $" + fmt.Sprintf("%d", argOffset+1)
		_ = argOffset
		args = append(args, adapterID, status)
	case adapterID != "":
		where += " AND adapter_id = $" + fmt.Sprintf("%d", argOffset)
		args = append(args, adapterID)
	case status != "":
		where += " AND status = $" + fmt.Sprintf("%d", argOffset)
		args = append(args, status)
	}
	offsetArg := fmt.Sprintf("$%d", len(args)+1)
	limitArg := fmt.Sprintf("$%d", len(args)+2)
	args = append(args, offset, limit)

	query := `SELECT id, tenant_id, adapter_id, target, status, result_count, error,
		        started_at, finished_at, created_at
			 FROM cmdb_discovery_jobs ` + where +
		` ORDER BY created_at DESC OFFSET ` + offsetArg + ` LIMIT ` + limitArg

	err := r.db.SelectContext(ctx, &items, query, args...)
	if err != nil {
		return nil, err
	}
	return items, nil
}

// UpdateJobStatus updates the status, result_count, error, and finished_at
// of a running/terminal job.
func (r *Repository) UpdateJobStatus(ctx context.Context, j *models.CMDBDiscoveryJob) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE cmdb_discovery_jobs
		   SET status = $1, result_count = $2, error = $3, finished_at = $4
		 WHERE id = $5 AND tenant_id = $6`,
		j.Status, j.ResultCount, j.Error, j.FinishedAt, j.ID, j.TenantID,
	)
	return err
}

// SetJobRunning marks a job as running and records its started_at.
func (r *Repository) SetJobRunning(ctx context.Context, id, tenantID string, startedAt time.Time) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE cmdb_discovery_jobs
		   SET status = 'running', started_at = $1
		 WHERE id = $2 AND tenant_id = $3`,
		startedAt, id, tenantID,
	)
	return err
}

// ===========================================================================
// Asset CRUD
// ===========================================================================

// CreateAsset inserts a new CMDBAsset.
func (r *Repository) CreateAsset(ctx context.Context, a *models.CMDBAsset) error {
	if a.ID == "" {
		a.ID = uuid.New().String()
	}
	now := time.Now().UTC()
	if a.DiscoveredAt.IsZero() {
		a.DiscoveredAt = now
	}
	a.CreatedAt = now

	_, err := r.db.ExecContext(ctx,
		`INSERT INTO cmdb_assets
			(id, tenant_id, name, adapter_id, asset_type, attributes, status,
			 discovered_at, created_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		a.ID, a.TenantID, a.Name, a.AdapterID, a.AssetType, a.Attributes,
		a.Status, a.DiscoveredAt, a.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("create asset: %w", err)
	}
	return nil
}

// UpsertAsset upserts a CMDBAsset keyed on (adapter_id, asset_type, name, tenant_id).
// Used by Discover() so that repeated sweeps update existing assets rather than
// creating duplicates.
func (r *Repository) UpsertAsset(ctx context.Context, a *models.CMDBAsset) error {
	now := time.Now().UTC()
	if a.ID == "" {
		a.ID = uuid.New().String()
	}
	if a.DiscoveredAt.IsZero() {
		a.DiscoveredAt = now
	}
	a.CreatedAt = now

	_, err := r.db.ExecContext(ctx,
		`INSERT INTO cmdb_assets
			(id, tenant_id, name, adapter_id, asset_type, attributes, status,
			 discovered_at, created_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		 ON CONFLICT (adapter_id, asset_type, name, tenant_id)
		 DO UPDATE SET
			attributes = EXCLUDED.attributes, status = EXCLUDED.status,
			discovered_at = EXCLUDED.discovered_at, created_at = EXCLUDED.created_at`,
		a.ID, a.TenantID, a.Name, a.AdapterID, a.AssetType, a.Attributes,
		a.Status, a.DiscoveredAt, a.CreatedAt,
	)
	return err
}

// GetAsset returns the asset with the given id, scoped by tenant.
func (r *Repository) GetAsset(ctx context.Context, tenantID, id string) (*models.CMDBAsset, error) {
	var a models.CMDBAsset
	err := r.db.GetContext(ctx, &a,
		`SELECT id, tenant_id, name, adapter_id, asset_type, attributes, status,
		        discovered_at, created_at
		 FROM cmdb_assets
		 WHERE id = $1 AND tenant_id = $2`,
		id, tenantID,
	)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// ListAssets returns paginated assets for a tenant, optionally filtered by
// adapter, asset type, or status.
func (r *Repository) ListAssets(ctx context.Context, tenantID, adapterID, assetType, status string, offset, limit int) ([]models.CMDBAsset, error) {
	var items []models.CMDBAsset

	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argOffset := 2

	switch {
	case adapterID != "" && assetType != "" && status != "":
		where += " AND adapter_id = $" + fmt.Sprintf("%d", argOffset) + " AND asset_type = $" + fmt.Sprintf("%d", argOffset+1) + " AND status = $" + fmt.Sprintf("%d", argOffset+2)
		args = append(args, adapterID, assetType, status)
	case adapterID != "" && assetType != "":
		where += " AND adapter_id = $" + fmt.Sprintf("%d", argOffset) + " AND asset_type = $" + fmt.Sprintf("%d", argOffset+1)
		args = append(args, adapterID, assetType)
	case adapterID != "":
		where += " AND adapter_id = $" + fmt.Sprintf("%d", argOffset)
		args = append(args, adapterID)
	case assetType != "":
		where += " AND asset_type = $" + fmt.Sprintf("%d", argOffset)
		args = append(args, assetType)
	case status != "":
		where += " AND status = $" + fmt.Sprintf("%d", argOffset)
		args = append(args, status)
	}
	offsetArg := fmt.Sprintf("$%d", len(args)+1)
	limitArg := fmt.Sprintf("$%d", len(args)+2)
	args = append(args, offset, limit)

	query := `SELECT id, tenant_id, name, adapter_id, asset_type, attributes, status,
		        discovered_at, created_at
			 FROM cmdb_assets ` + where +
		` ORDER BY discovered_at DESC OFFSET ` + offsetArg + ` LIMIT ` + limitArg

	err := r.db.SelectContext(ctx, &items, query, args...)
	if err != nil {
		return nil, err
	}
	return items, nil
}

// DeleteAsset hard-deletes an asset, scoped by tenant.
func (r *Repository) DeleteAsset(ctx context.Context, tenantID, id string) error {
	res, err := r.db.ExecContext(ctx,
		`DELETE FROM cmdb_assets WHERE id = $1 AND tenant_id = $2`, id, tenantID,
	)
	if err != nil {
		return fmt.Errorf("delete asset: %w", err)
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// CountAssets returns the number of assets for a tenant.
func (r *Repository) CountAssets(ctx context.Context, tenantID string) (int, error) {
	var n int
	err := r.db.GetContext(ctx, &n,
		`SELECT COUNT(*) FROM cmdb_assets WHERE tenant_id = $1`, tenantID,
	)
	return n, err
}
