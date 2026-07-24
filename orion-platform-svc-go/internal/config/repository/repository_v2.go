package repository

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/config/models"

	"github.com/jmoiron/sqlx"
)

// RepositoryV2 wraps the core Repository to provide blueprint-extended methods
// (drift, feature flags, git sync, approvals) that operate on key-value style
// config tables, distinct from the existing Config-based repository.
type RepositoryV2 struct {
	*Repository
}

// NewRepositoryV2 creates a V2 repository wrapping the base repository.
func NewRepositoryV2(db *sqlx.DB) *RepositoryV2 {
	return &RepositoryV2{Repository: NewRepository(db)}
}

// ==================== Drift Detection ====================

// CreateDriftV2 inserts a new drift record.
func (r *RepositoryV2) CreateDriftV2(ctx context.Context, d *models.DriftRecord) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO config_drifts (id, tenant_id, config_id, config_key, environment, expected_value, actual_value, drift_type, detected_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		d.ID, d.TenantID, d.ConfigID, d.ConfigKey, d.Environment, d.ExpectedValue, d.ActualValue, d.DriftType, d.DetectedAt)
	return err
}

// ListDriftsV2 returns drift records for a tenant.
func (r *RepositoryV2) ListDriftsV2(ctx context.Context, tenantID, environment string, unresolvedOnly bool) ([]models.DriftRecord, error) {
	var items []models.DriftRecord
	query := `SELECT * FROM config_drifts WHERE tenant_id=$1`
	args := []any{tenantID}
	if environment != "" {
		query += ` AND environment=$2`
		args = append(args, environment)
	}
	if unresolvedOnly {
		query += ` AND resolved_at IS NULL`
	}
	query += ` ORDER BY detected_at DESC`
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

// ResolveDriftV2 marks a drift as resolved.
func (r *RepositoryV2) ResolveDriftV2(ctx context.Context, tenantID, id, resolvedBy string) error {
	now := time.Now()
	_, err := r.db.ExecContext(ctx,
		`UPDATE config_drifts SET resolved_at=$1, resolved_by=$2 WHERE id=$3 AND tenant_id=$4`,
		now, resolvedBy, id, tenantID)
	return err
}

// CountUnresolvedDriftsV2 counts unresolved drifts for a tenant.
func (r *RepositoryV2) CountUnresolvedDriftsV2(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM config_drifts WHERE tenant_id=$1 AND resolved_at IS NULL`, tenantID)
	return count, err
}

// ==================== Feature Flags ====================

// CreateFeatureFlagV2 inserts a feature flag.
func (r *RepositoryV2) CreateFeatureFlagV2(ctx context.Context, f *models.FeatureFlag) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO feature_flags (id, tenant_id, key, name, description, enabled, environment, flag_type, rollout_pct, whitelist, variations, tags)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
		f.ID, f.TenantID, f.Key, f.Name, f.Description, f.Enabled, f.Environment, f.FlagType, f.RolloutPct, f.Whitelist, f.Variations, f.Tags)
	return err
}

// GetFeatureFlagV2 retrieves a feature flag by tenant/key/environment.
func (r *RepositoryV2) GetFeatureFlagV2(ctx context.Context, tenantID, key, environment string) (*models.FeatureFlag, error) {
	var f models.FeatureFlag
	err := r.db.GetContext(ctx, &f,
		`SELECT * FROM feature_flags WHERE tenant_id=$1 AND key=$2 AND environment=$3`,
		tenantID, key, environment)
	if err != nil {
		return nil, err
	}
	return &f, nil
}

// ListFeatureFlagsV2 lists feature flags for a tenant.
func (r *RepositoryV2) ListFeatureFlagsV2(ctx context.Context, tenantID, environment string) ([]models.FeatureFlag, error) {
	var items []models.FeatureFlag
	query := `SELECT * FROM feature_flags WHERE tenant_id=$1`
	args := []any{tenantID}
	if environment != "" {
		query += ` AND environment=$2`
		args = append(args, environment)
	}
	query += ` ORDER BY key`
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

// UpdateFeatureFlagV2 updates a feature flag.
func (r *RepositoryV2) UpdateFeatureFlagV2(ctx context.Context, f *models.FeatureFlag) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE feature_flags SET name=$1, description=$2, enabled=$3, flag_type=$4, rollout_pct=$5, whitelist=$6, variations=$7, tags=$8, updated_at=$9
		 WHERE id=$10 AND tenant_id=$11`,
		f.Name, f.Description, f.Enabled, f.FlagType, f.RolloutPct, f.Whitelist, f.Variations, f.Tags, time.Now(), f.ID, f.TenantID)
	return err
}

// DeleteFeatureFlagV2 deletes a feature flag.
func (r *RepositoryV2) DeleteFeatureFlagV2(ctx context.Context, tenantID, key, environment string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM feature_flags WHERE tenant_id=$1 AND key=$2 AND environment=$3`,
		tenantID, key, environment)
	return err
}

// ==================== Git Sync ====================

// CreateGitSyncV2 inserts a Git sync configuration.
func (r *RepositoryV2) CreateGitSyncV2(ctx context.Context, g *models.GitSyncConfig) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO git_sync_configs (id, tenant_id, name, repo_url, branch, path, environment, auto_sync, sync_interval_sec, enabled)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		g.ID, g.TenantID, g.Name, g.RepoURL, g.Branch, g.Path, g.Environment, g.AutoSync, g.SyncIntervalSec, g.Enabled)
	return err
}

// GetGitSyncV2 retrieves a Git sync configuration.
func (r *RepositoryV2) GetGitSyncV2(ctx context.Context, tenantID, id string) (*models.GitSyncConfig, error) {
	var g models.GitSyncConfig
	err := r.db.GetContext(ctx, &g,
		`SELECT * FROM git_sync_configs WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &g, nil
}

// ListGitSyncsV2 lists all Git sync configurations for a tenant.
func (r *RepositoryV2) ListGitSyncsV2(ctx context.Context, tenantID string) ([]models.GitSyncConfig, error) {
	var items []models.GitSyncConfig
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM git_sync_configs WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return items, err
}

// UpdateGitSyncV2 updates a Git sync configuration.
func (r *RepositoryV2) UpdateGitSyncV2(ctx context.Context, g *models.GitSyncConfig) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE git_sync_configs SET name=$1, repo_url=$2, branch=$3, path=$4, environment=$5, auto_sync=$6, sync_interval_sec=$7, enabled=$8, updated_at=$9
		 WHERE id=$10 AND tenant_id=$11`,
		g.Name, g.RepoURL, g.Branch, g.Path, g.Environment, g.AutoSync, g.SyncIntervalSec, g.Enabled, time.Now(), g.ID, g.TenantID)
	return err
}

// UpdateGitSyncStatusV2 updates the last sync status.
func (r *RepositoryV2) UpdateGitSyncStatusV2(ctx context.Context, tenantID, id, status string) error {
	now := time.Now()
	_, err := r.db.ExecContext(ctx,
		`UPDATE git_sync_configs SET last_sync_at=$1, last_sync_status=$2 WHERE id=$3 AND tenant_id=$4`,
		now, status, id, tenantID)
	return err
}

// DeleteGitSyncV2 deletes a Git sync configuration.
func (r *RepositoryV2) DeleteGitSyncV2(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM git_sync_configs WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// ==================== Config Approvals ====================

// CreateApprovalV2 inserts an approval request.
func (r *RepositoryV2) CreateApprovalV2(ctx context.Context, a *models.ConfigApproval) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO config_approvals (id, tenant_id, config_key, environment, current_value, proposed_value, status, requested_by, requested_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		a.ID, a.TenantID, a.ConfigKey, a.Environment, a.CurrentValue, a.ProposedValue, a.Status, a.RequestedBy, a.RequestedAt)
	return err
}

// GetApprovalV2 retrieves an approval by ID.
func (r *RepositoryV2) GetApprovalV2(ctx context.Context, tenantID, id string) (*models.ConfigApproval, error) {
	var a models.ConfigApproval
	err := r.db.GetContext(ctx, &a,
		`SELECT * FROM config_approvals WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// ListApprovalsV2 lists approvals for a tenant.
func (r *RepositoryV2) ListApprovalsV2(ctx context.Context, tenantID, status string) ([]models.ConfigApproval, error) {
	var items []models.ConfigApproval
	query := `SELECT * FROM config_approvals WHERE tenant_id=$1`
	args := []any{tenantID}
	if status != "" {
		query += ` AND status=$2`
		args = append(args, status)
	}
	query += ` ORDER BY requested_at DESC`
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

// UpdateApprovalStatusV2 updates approval status.
func (r *RepositoryV2) UpdateApprovalStatusV2(ctx context.Context, tenantID, id, status, reviewedBy, comment string) error {
	now := time.Now()
	_, err := r.db.ExecContext(ctx,
		`UPDATE config_approvals SET status=$1, reviewed_by=$2, review_comment=$3, reviewed_at=$4 WHERE id=$5 AND tenant_id=$6`,
		status, reviewedBy, comment, now, id, tenantID)
	return err
}

// MarkApprovalAppliedV2 marks an approval as applied.
func (r *RepositoryV2) MarkApprovalAppliedV2(ctx context.Context, tenantID, id string) error {
	now := time.Now()
	_, err := r.db.ExecContext(ctx,
		`UPDATE config_approvals SET status='applied', applied_at=$1 WHERE id=$2 AND tenant_id=$3`,
		now, id, tenantID)
	return err
}

// ==================== Config Snapshots (blueprint-style) ====================

// CreateSnapshotV2 inserts a blueprint-style snapshot.
func (r *RepositoryV2) CreateSnapshotV2(ctx context.Context, s *models.ConfigSnapshotV2) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO config_snapshots (id, tenant_id, config_id, version_id, data, description, created_by)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		s.ID, s.TenantID, s.ConfigID, s.VersionID, s.Data, s.Description, s.CreatedBy)
	return err
}

// ListSnapshotsV2 lists snapshots for a config (blueprint pagination).
func (r *RepositoryV2) ListSnapshotsV2(ctx context.Context, tenantID, configID string, offset, limit int) ([]models.ConfigSnapshotV2, error) {
	var items []models.ConfigSnapshotV2
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM config_snapshots WHERE tenant_id=$1 AND config_id=$2 ORDER BY created_at DESC OFFSET $3 LIMIT $4`,
		tenantID, configID, offset, limit)
	return items, err
}

// GetSnapshotV2 retrieves a snapshot by ID.
func (r *RepositoryV2) GetSnapshotV2(ctx context.Context, tenantID, id string) (*models.ConfigSnapshotV2, error) {
	var s models.ConfigSnapshotV2
	err := r.db.GetContext(ctx, &s,
		`SELECT * FROM config_snapshots WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// DeleteSnapshotV2 deletes a snapshot.
func (r *RepositoryV2) DeleteSnapshotV2(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM config_snapshots WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// ==================== Config Canary (blueprint-style) ====================

// CreateCanaryV2 inserts a blueprint-style canary deployment.
func (r *RepositoryV2) CreateCanaryV2(ctx context.Context, c *models.ConfigCanary) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO config_canaries (id, tenant_id, config_id, canary_value, baseline_value, status, created_by)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		c.ID, c.TenantID, c.ConfigID, c.CanaryValue, c.BaselineValue, c.Status, c.CreatedBy)
	return err
}

// GetCanaryV2 retrieves a canary by ID.
func (r *RepositoryV2) GetCanaryV2(ctx context.Context, tenantID, id string) (*models.ConfigCanary, error) {
	var c models.ConfigCanary
	err := r.db.GetContext(ctx, &c,
		`SELECT * FROM config_canaries WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

// GetActiveCanaryV2 retrieves the active canary for a config.
func (r *RepositoryV2) GetActiveCanaryV2(ctx context.Context, tenantID, configID string) (*models.ConfigCanary, error) {
	var c models.ConfigCanary
	err := r.db.GetContext(ctx, &c,
		`SELECT * FROM config_canaries WHERE tenant_id=$1 AND config_id=$2 AND status=$3 ORDER BY created_at DESC LIMIT 1`,
		tenantID, configID, models.CanaryStatusActive)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

// UpdateCanaryStatusV2 updates canary status.
func (r *RepositoryV2) UpdateCanaryStatusV2(ctx context.Context, tenantID, id, status string) error {
	now := time.Now()
	_, err := r.db.ExecContext(ctx,
		`UPDATE config_canaries SET status=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4`,
		status, now, id, tenantID)
	return err
}
