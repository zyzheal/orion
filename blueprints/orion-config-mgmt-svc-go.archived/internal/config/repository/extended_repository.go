package repository

import (
	"context"
	"time"

	"orion/config-mgmt-svc-go/internal/config/models"
)

// ==================== Drift Detection ====================

func (r *Repository) CreateDrift(ctx context.Context, d *models.DriftRecord) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO config_drifts (id, tenant_id, config_id, config_key, environment, expected_value, actual_value, drift_type, detected_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		d.ID, d.TenantID, d.ConfigID, d.ConfigKey, d.Environment, d.ExpectedValue, d.ActualValue, d.DriftType, d.DetectedAt)
	return err
}

func (r *Repository) ListDrifts(ctx context.Context, tenantID, environment string, unresolvedOnly bool) ([]models.DriftRecord, error) {
	var items []models.DriftRecord
	query := `SELECT * FROM config_drifts WHERE tenant_id=$1`
	args := []interface{}{tenantID}
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

func (r *Repository) ResolveDrift(ctx context.Context, tenantID, id, resolvedBy string) error {
	now := time.Now()
	_, err := r.db.ExecContext(ctx,
		`UPDATE config_drifts SET resolved_at=$1, resolved_by=$2 WHERE id=$3 AND tenant_id=$4`,
		now, resolvedBy, id, tenantID)
	return err
}

func (r *Repository) CountUnresolvedDrifts(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM config_drifts WHERE tenant_id=$1 AND resolved_at IS NULL`, tenantID)
	return count, err
}

// ==================== Feature Flags ====================

func (r *Repository) CreateFeatureFlag(ctx context.Context, f *models.FeatureFlag) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO feature_flags (id, tenant_id, key, name, description, enabled, environment, flag_type, rollout_pct, whitelist, variations, tags)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
		f.ID, f.TenantID, f.Key, f.Name, f.Description, f.Enabled, f.Environment, f.FlagType, f.RolloutPct, f.Whitelist, f.Variations, f.Tags)
	return err
}

func (r *Repository) GetFeatureFlag(ctx context.Context, tenantID, key, environment string) (*models.FeatureFlag, error) {
	var f models.FeatureFlag
	err := r.db.GetContext(ctx, &f,
		`SELECT * FROM feature_flags WHERE tenant_id=$1 AND key=$2 AND environment=$3`,
		tenantID, key, environment)
	if err != nil {
		return nil, err
	}
	return &f, nil
}

func (r *Repository) ListFeatureFlags(ctx context.Context, tenantID, environment string) ([]models.FeatureFlag, error) {
	var items []models.FeatureFlag
	query := `SELECT * FROM feature_flags WHERE tenant_id=$1`
	args := []interface{}{tenantID}
	if environment != "" {
		query += ` AND environment=$2`
		args = append(args, environment)
	}
	query += ` ORDER BY key`
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

func (r *Repository) UpdateFeatureFlag(ctx context.Context, f *models.FeatureFlag) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE feature_flags SET name=$1, description=$2, enabled=$3, flag_type=$4, rollout_pct=$5, whitelist=$6, variations=$7, tags=$8, updated_at=$9
		 WHERE id=$10 AND tenant_id=$11`,
		f.Name, f.Description, f.Enabled, f.FlagType, f.RolloutPct, f.Whitelist, f.Variations, f.Tags, time.Now(), f.ID, f.TenantID)
	return err
}

func (r *Repository) DeleteFeatureFlag(ctx context.Context, tenantID, key, environment string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM feature_flags WHERE tenant_id=$1 AND key=$2 AND environment=$3`,
		tenantID, key, environment)
	return err
}

// ==================== Git Sync ====================

func (r *Repository) CreateGitSync(ctx context.Context, g *models.GitSyncConfig) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO git_sync_configs (id, tenant_id, name, repo_url, branch, path, environment, auto_sync, sync_interval_sec, enabled)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		g.ID, g.TenantID, g.Name, g.RepoURL, g.Branch, g.Path, g.Environment, g.AutoSync, g.SyncIntervalSec, g.Enabled)
	return err
}

func (r *Repository) GetGitSync(ctx context.Context, tenantID, id string) (*models.GitSyncConfig, error) {
	var g models.GitSyncConfig
	err := r.db.GetContext(ctx, &g,
		`SELECT * FROM git_sync_configs WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &g, nil
}

func (r *Repository) ListGitSyncs(ctx context.Context, tenantID string) ([]models.GitSyncConfig, error) {
	var items []models.GitSyncConfig
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM git_sync_configs WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return items, err
}

func (r *Repository) UpdateGitSync(ctx context.Context, g *models.GitSyncConfig) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE git_sync_configs SET name=$1, repo_url=$2, branch=$3, path=$4, environment=$5, auto_sync=$6, sync_interval_sec=$7, enabled=$8, updated_at=$9
		 WHERE id=$10 AND tenant_id=$11`,
		g.Name, g.RepoURL, g.Branch, g.Path, g.Environment, g.AutoSync, g.SyncIntervalSec, g.Enabled, time.Now(), g.ID, g.TenantID)
	return err
}

func (r *Repository) UpdateGitSyncStatus(ctx context.Context, tenantID, id, status string) error {
	now := time.Now()
	_, err := r.db.ExecContext(ctx,
		`UPDATE git_sync_configs SET last_sync_at=$1, last_sync_status=$2 WHERE id=$3 AND tenant_id=$4`,
		now, status, id, tenantID)
	return err
}

func (r *Repository) DeleteGitSync(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM git_sync_configs WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// ==================== Config Approvals ====================

func (r *Repository) CreateApproval(ctx context.Context, a *models.ConfigApproval) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO config_approvals (id, tenant_id, config_key, environment, current_value, proposed_value, status, requested_by, requested_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		a.ID, a.TenantID, a.ConfigKey, a.Environment, a.CurrentValue, a.ProposedValue, a.Status, a.RequestedBy, a.RequestedAt)
	return err
}

func (r *Repository) GetApproval(ctx context.Context, tenantID, id string) (*models.ConfigApproval, error) {
	var a models.ConfigApproval
	err := r.db.GetContext(ctx, &a,
		`SELECT * FROM config_approvals WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (r *Repository) ListApprovals(ctx context.Context, tenantID, status string) ([]models.ConfigApproval, error) {
	var items []models.ConfigApproval
	query := `SELECT * FROM config_approvals WHERE tenant_id=$1`
	args := []interface{}{tenantID}
	if status != "" {
		query += ` AND status=$2`
		args = append(args, status)
	}
	query += ` ORDER BY requested_at DESC`
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

func (r *Repository) UpdateApprovalStatus(ctx context.Context, tenantID, id, status, reviewedBy, comment string) error {
	now := time.Now()
	_, err := r.db.ExecContext(ctx,
		`UPDATE config_approvals SET status=$1, reviewed_by=$2, review_comment=$3, reviewed_at=$4 WHERE id=$5 AND tenant_id=$6`,
		status, reviewedBy, comment, now, id, tenantID)
	return err
}

func (r *Repository) MarkApprovalApplied(ctx context.Context, tenantID, id string) error {
	now := time.Now()
	_, err := r.db.ExecContext(ctx,
		`UPDATE config_approvals SET status='applied', applied_at=$1 WHERE id=$2 AND tenant_id=$3`,
		now, id, tenantID)
	return err
}

// ==================== Config Snapshots ====================

func (r *Repository) CreateSnapshot(ctx context.Context, s *models.ConfigSnapshot) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO config_snapshots (id, tenant_id, config_id, version_id, data, description, created_by)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		s.ID, s.TenantID, s.ConfigID, s.VersionID, s.Data, s.Description, s.CreatedBy)
	return err
}

func (r *Repository) ListSnapshots(ctx context.Context, tenantID, configID string, offset, limit int) ([]models.ConfigSnapshot, error) {
	var items []models.ConfigSnapshot
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM config_snapshots WHERE tenant_id=$1 AND config_id=$2 ORDER BY created_at DESC OFFSET $3 LIMIT $4`,
		tenantID, configID, offset, limit)
	return items, err
}

func (r *Repository) GetSnapshot(ctx context.Context, tenantID, id string) (*models.ConfigSnapshot, error) {
	var s models.ConfigSnapshot
	err := r.db.GetContext(ctx, &s,
		`SELECT * FROM config_snapshots WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *Repository) DeleteSnapshot(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM config_snapshots WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// ==================== Config Canary ====================

func (r *Repository) CreateCanary(ctx context.Context, c *models.ConfigCanary) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO config_canaries (id, tenant_id, config_id, canary_value, baseline_value, status, created_by)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		c.ID, c.TenantID, c.ConfigID, c.CanaryValue, c.BaselineValue, c.Status, c.CreatedBy)
	return err
}

func (r *Repository) GetCanary(ctx context.Context, tenantID, id string) (*models.ConfigCanary, error) {
	var c models.ConfigCanary
	err := r.db.GetContext(ctx, &c,
		`SELECT * FROM config_canaries WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *Repository) GetActiveCanary(ctx context.Context, tenantID, configID string) (*models.ConfigCanary, error) {
	var c models.ConfigCanary
	err := r.db.GetContext(ctx, &c,
		`SELECT * FROM config_canaries WHERE tenant_id=$1 AND config_id=$2 AND status=$3 ORDER BY created_at DESC LIMIT 1`,
		tenantID, configID, models.CanaryStatusActive)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *Repository) UpdateCanaryStatus(ctx context.Context, tenantID, id, status string) error {
	now := time.Now()
	_, err := r.db.ExecContext(ctx,
		`UPDATE config_canaries SET status=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4`,
		status, now, id, tenantID)
	return err
}
