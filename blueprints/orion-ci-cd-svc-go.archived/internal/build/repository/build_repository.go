package repository

import (
	"context"
	"database/sql"
	"fmt"
	"orion/ci-cd-svc-go/internal/build/models"
	"strings"
	"orion/go-common/pkg/database"
)

// BuildRepository handles all database operations for builds, environments, and artifacts.
type BuildRepository struct {
	db *database.DB
}

func NewBuildRepository(db *database.DB) *BuildRepository {
	return &BuildRepository{db: db}
}

// ==================== Builds ====================

func (r *BuildRepository) Create(ctx context.Context, b *models.Build) error {
	query := `
		INSERT INTO builds (tenant_id, project_id, pipeline_run_id, repo_id, branch, commit_sha,
			image, tag, source_ref, build_args, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id, created_at`
	return r.db.QueryRowContext(ctx, query,
		b.TenantID, b.ProjectID, b.PipelineRunID, b.RepoID, b.Branch, b.CommitSHA,
		b.Image, b.Tag, b.SourceRef, b.BuildArgs, b.Status,
	).Scan(&b.ID, &b.CreatedAt)
}

func (r *BuildRepository) GetByID(ctx context.Context, tenantID, id string) (*models.Build, error) {
	var b models.Build
	query := `SELECT id, tenant_id, project_id, pipeline_run_id, repo_id, branch, commit_sha,
		image, tag, source_ref, build_args, status, started_at, completed_at,
		duration_ms, error_message, logs, created_at
		FROM builds WHERE id = $1 AND tenant_id = $2`
	err := r.db.GetContext(ctx, &b, query, id, tenantID)
	if err != nil {
		return nil, fmt.Errorf("build not found: %w", err)
	}
	return &b, nil
}

func (r *BuildRepository) List(ctx context.Context, tenantID string, filter models.ListBuildsFilter, offset, limit int) ([]models.Build, error) {
	var builds []models.Build
	var conditions []string
	var args []interface{}
	argIdx := 1

	conditions = append(conditions, fmt.Sprintf("tenant_id = $%d", argIdx))
	args = append(args, tenantID)
	argIdx++

	if filter.ProjectID != "" {
		conditions = append(conditions, fmt.Sprintf("project_id = $%d", argIdx))
		args = append(args, filter.ProjectID)
		argIdx++
	}
	if filter.Status != "" {
		conditions = append(conditions, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, filter.Status)
		argIdx++
	}

	where := "WHERE " + strings.Join(conditions, " AND ")

	query := fmt.Sprintf(`SELECT id, tenant_id, project_id, pipeline_run_id, repo_id, branch, commit_sha,
		image, tag, source_ref, build_args, status, started_at, completed_at,
		duration_ms, error_message, logs, created_at
		FROM builds %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, where, argIdx, argIdx+1)
	args = append(args, limit, offset)

	err := r.db.SelectContext(ctx, &builds, query, args...)
	if err != nil {
		return nil, err
	}
	return builds, nil
}

func (r *BuildRepository) Update(ctx context.Context, b *models.Build) error {
	query := `
		UPDATE builds SET repo_id = $1, branch = $2, commit_sha = $3, status = $4,
			started_at = $5, completed_at = $6, image = $7, tag = $8,
			duration_ms = $9, error_message = $10, logs = $11
		WHERE id = $12 AND tenant_id = $13`
	_, err := r.db.ExecContext(ctx, query,
		b.RepoID, b.Branch, b.CommitSHA, b.Status,
		b.StartedAt, b.CompletedAt, b.Image, b.Tag,
		b.DurationMs, b.ErrorMessage, b.Logs,
		b.ID, b.TenantID,
	)
	return err
}

func (r *BuildRepository) UpdateStatus(ctx context.Context, tenantID, id, status string) error {
	query := `UPDATE builds SET status = $1 WHERE id = $2 AND tenant_id = $3`
	_, err := r.db.ExecContext(ctx, query, status, id, tenantID)
	return err
}

func (r *BuildRepository) Delete(ctx context.Context, tenantID, id string) error {
	query := `DELETE FROM builds WHERE id = $1 AND tenant_id = $2`
	_, err := r.db.ExecContext(ctx, query, id, tenantID)
	return err
}

func (r *BuildRepository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM builds WHERE tenant_id=$1`, tenantID)
	return count, err
}

// CountFiltered returns the count of builds matching the given filters, scoped to tenant.
func (r *BuildRepository) CountFiltered(ctx context.Context, tenantID string, filter models.ListBuildsFilter) (int, error) {
	var conditions []string
	var args []interface{}
	argIdx := 1

	conditions = append(conditions, fmt.Sprintf("tenant_id = $%d", argIdx))
	args = append(args, tenantID)
	argIdx++

	if filter.ProjectID != "" {
		conditions = append(conditions, fmt.Sprintf("project_id = $%d", argIdx))
		args = append(args, filter.ProjectID)
		argIdx++
	}
	if filter.Status != "" {
		conditions = append(conditions, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, filter.Status)
		argIdx++
	}

	where := "WHERE " + strings.Join(conditions, " AND ")

	query := fmt.Sprintf("SELECT COUNT(*) FROM builds %s", where)
	var count int
	err := r.db.GetContext(ctx, &count, query, args...)
	return count, err
}

// StartBuild sets a build's status to 'running' and records started_at.
func (r *BuildRepository) StartBuild(ctx context.Context, tenantID, id string) (*models.Build, error) {
	query := `UPDATE builds SET status = 'running', started_at = NOW()
		WHERE id = $1 AND tenant_id = $2 AND status = 'pending'
		RETURNING id, tenant_id, project_id, pipeline_run_id, repo_id, branch, commit_sha,
			image, tag, source_ref, build_args, status, started_at, completed_at,
			duration_ms, error_message, logs, created_at`
	var b models.Build
	err := r.db.GetContext(ctx, &b, query, id, tenantID)
	if err != nil {
		return nil, fmt.Errorf("cannot start build: %w", err)
	}
	return &b, nil
}

// CompleteBuild marks a build as completed (success/failed/cancelled) with duration calculation.
func (r *BuildRepository) CompleteBuild(ctx context.Context, tenantID, id, status, errorMessage string) (*models.Build, error) {
	var errMsg interface{}
	if errorMessage != "" {
		errMsg = errorMessage
	}

	query := `UPDATE builds SET
		status = $1,
		completed_at = NOW(),
		duration_ms = EXTRACT(EPOCH FROM (NOW() - COALESCE(started_at, created_at)))::BIGINT * 1000,
		error_message = $2
		WHERE id = $3 AND tenant_id = $4
		RETURNING id, tenant_id, project_id, pipeline_run_id, repo_id, branch, commit_sha,
			image, tag, source_ref, build_args, status, started_at, completed_at,
			duration_ms, error_message, logs, created_at`
	var b models.Build
	err := r.db.GetContext(ctx, &b, query, status, errMsg, id, tenantID)
	if err != nil {
		return nil, fmt.Errorf("cannot complete build: %w", err)
	}
	return &b, nil
}

// FindByPipelineRun finds the most recent build for a pipeline run.
func (r *BuildRepository) FindByPipelineRun(ctx context.Context, tenantID, pipelineRunID string) (*models.Build, error) {
	var b models.Build
	query := `SELECT id, tenant_id, project_id, pipeline_run_id, repo_id, branch, commit_sha,
		image, tag, source_ref, build_args, status, started_at, completed_at,
		duration_ms, error_message, logs, created_at
		FROM builds WHERE pipeline_run_id = $1 AND tenant_id = $2
		ORDER BY created_at DESC LIMIT 1`
	err := r.db.GetContext(ctx, &b, query, pipelineRunID, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &b, nil
}

// GetBuildStats returns aggregated build statistics for a tenant.
func (r *BuildRepository) GetBuildStats(ctx context.Context, tenantID string) (*models.BuildStats, error) {
	var stats models.BuildStats
	query := `SELECT
		COUNT(*) AS total,
		COALESCE(SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END), 0) AS success,
		COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) AS failed,
		COALESCE(SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END), 0) AS running,
		COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending,
		COALESCE(AVG(duration_ms), 0) AS avg_duration
		FROM builds WHERE tenant_id = $1`
	err := r.db.GetContext(ctx, &stats, query, tenantID)
	if err != nil {
		return nil, err
	}
	return &stats, nil
}

// ==================== Build Environments ====================

func (r *BuildRepository) CreateEnvironment(ctx context.Context, env *models.BuildEnvironment) error {
	query := `INSERT INTO build_environments (tenant_id, name, type, image, description, config)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at, updated_at`
	return r.db.QueryRowContext(ctx, query,
		env.TenantID, env.Name, env.Type, env.Image, env.Description, env.Config,
	).Scan(&env.ID, &env.CreatedAt, &env.UpdatedAt)
}

func (r *BuildRepository) GetEnvironmentByID(ctx context.Context, tenantID, id string) (*models.BuildEnvironment, error) {
	var env models.BuildEnvironment
	query := `SELECT id, tenant_id, name, type, image, description, config, status, created_at, updated_at
		FROM build_environments WHERE id = $1 AND tenant_id = $2`
	err := r.db.GetContext(ctx, &env, query, id, tenantID)
	if err != nil {
		return nil, fmt.Errorf("environment not found: %w", err)
	}
	return &env, nil
}

func (r *BuildRepository) ListEnvironments(ctx context.Context, tenantID string) ([]models.BuildEnvironment, error) {
	var envs []models.BuildEnvironment
	query := `SELECT id, tenant_id, name, type, image, description, config, status, created_at, updated_at
		FROM build_environments WHERE tenant_id = $1 AND status != 'deleted' ORDER BY created_at DESC`
	err := r.db.SelectContext(ctx, &envs, query, tenantID)
	if err != nil {
		return nil, err
	}
	return envs, nil
}

func (r *BuildRepository) UpdateEnvironment(ctx context.Context, env *models.BuildEnvironment) error {
	query := `UPDATE build_environments SET name = $1, type = $2, image = $3,
		description = $4, config = $5, status = $6, updated_at = NOW()
		WHERE id = $7 AND tenant_id = $8`
	_, err := r.db.ExecContext(ctx, query,
		env.Name, env.Type, env.Image, env.Description, env.Config, env.Status, env.ID, env.TenantID,
	)
	return err
}

func (r *BuildRepository) DeleteEnvironment(ctx context.Context, tenantID, id string) error {
	query := `UPDATE build_environments SET status = 'deleted', updated_at = NOW() WHERE id = $1 AND tenant_id = $2`
	_, err := r.db.ExecContext(ctx, query, id, tenantID)
	return err
}

// ==================== Artifacts ====================

func (r *BuildRepository) CreateArtifact(ctx context.Context, a *models.Artifact) error {
	query := `INSERT INTO artifacts (tenant_id, name, type, storage_type, storage_path,
		size_bytes, checksum_sha256, run_id, stage_id, expires_at, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id, created_at, updated_at`
	return r.db.QueryRowContext(ctx, query,
		a.TenantID, a.Name, a.Type, a.StorageType, a.StoragePath,
		a.SizeBytes, a.ChecksumSHA256, a.RunID, a.StageID, a.ExpiresAt, a.Metadata,
	).Scan(&a.ID, &a.CreatedAt, &a.UpdatedAt)
}

func (r *BuildRepository) GetArtifactByID(ctx context.Context, tenantID, id string) (*models.Artifact, error) {
	var a models.Artifact
	query := `SELECT id, tenant_id, name, type, storage_type, storage_path, size_bytes,
		checksum_sha256, run_id, stage_id, expires_at, downloaded_count, metadata, created_at, updated_at
		FROM artifacts WHERE id = $1 AND tenant_id = $2`
	err := r.db.GetContext(ctx, &a, query, id, tenantID)
	if err != nil {
		return nil, fmt.Errorf("artifact not found: %w", err)
	}
	return &a, nil
}

func (r *BuildRepository) ListArtifacts(ctx context.Context, tenantID string, filter models.ListArtifactFilter, offset, limit int) ([]models.Artifact, error) {
	var artifacts []models.Artifact
	var conditions []string
	var args []interface{}
	argIdx := 1

	conditions = append(conditions, fmt.Sprintf("tenant_id = $%d", argIdx))
	args = append(args, tenantID)
	argIdx++

	if filter.RunID != "" {
		conditions = append(conditions, fmt.Sprintf("run_id = $%d", argIdx))
		args = append(args, filter.RunID)
		argIdx++
	}
	if filter.StageID != "" {
		conditions = append(conditions, fmt.Sprintf("stage_id = $%d", argIdx))
		args = append(args, filter.StageID)
		argIdx++
	}
	if filter.Type != "" {
		conditions = append(conditions, fmt.Sprintf("type = $%d", argIdx))
		args = append(args, filter.Type)
		argIdx++
	}

	where := "WHERE " + strings.Join(conditions, " AND ")
	query := fmt.Sprintf(`SELECT id, tenant_id, name, type, storage_type, storage_path, size_bytes,
		checksum_sha256, run_id, stage_id, expires_at, downloaded_count, metadata, created_at, updated_at
		FROM artifacts %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, where, argIdx, argIdx+1)
	args = append(args, limit, offset)

	err := r.db.SelectContext(ctx, &artifacts, query, args...)
	if err != nil {
		return nil, err
	}
	return artifacts, nil
}

func (r *BuildRepository) DeleteArtifact(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM artifacts WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

func (r *BuildRepository) IncrementDownloadCount(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE artifacts SET downloaded_count = downloaded_count + 1, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

func (r *BuildRepository) CleanupExpiredArtifacts(ctx context.Context, tenantID string) (int, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM artifacts WHERE tenant_id = $1 AND expires_at IS NOT NULL AND expires_at < NOW()`, tenantID)
	if err != nil {
		return 0, err
	}
	rows, _ := result.RowsAffected()
	return int(rows), nil
}

func (r *BuildRepository) CleanupArtifactsByRun(ctx context.Context, tenantID, runID string) (int, error) {
	result, err := r.db.ExecContext(ctx, `DELETE FROM artifacts WHERE tenant_id = $1 AND run_id = $2`, tenantID, runID)
	if err != nil {
		return 0, err
	}
	rows, _ := result.RowsAffected()
	return int(rows), nil
}

// ==================== Builder Images ====================

func (r *BuildRepository) CreateBuilderImage(ctx context.Context, img *models.BuilderImage) error {
	query := `INSERT INTO builder_images (tenant_id, name, display_name, image, type, version,
		description, pull_policy, status, is_preset, env, labels, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		RETURNING id, created_at, updated_at`
	return r.db.QueryRowContext(ctx, query,
		img.TenantID, img.Name, img.DisplayName, img.Image, img.Type, img.Version,
		img.Description, img.PullPolicy, img.Status, img.IsPreset, img.Env, img.Labels, img.CreatedBy,
	).Scan(&img.ID, &img.CreatedAt, &img.UpdatedAt)
}

func (r *BuildRepository) GetBuilderImageByID(ctx context.Context, tenantID, id string) (*models.BuilderImage, error) {
	var img models.BuilderImage
	query := `SELECT id, tenant_id, name, display_name, image, type, version, description,
		pull_policy, status, is_preset, env, labels, created_by, created_at, updated_at
		FROM builder_images WHERE id = $1 AND tenant_id = $2`
	err := r.db.GetContext(ctx, &img, query, id, tenantID)
	if err != nil {
		return nil, fmt.Errorf("builder image not found: %w", err)
	}
	return &img, nil
}

func (r *BuildRepository) GetBuilderImageByName(ctx context.Context, tenantID, name string) (*models.BuilderImage, error) {
	var img models.BuilderImage
	query := `SELECT id, tenant_id, name, display_name, image, type, version, description,
		pull_policy, status, is_preset, env, labels, created_by, created_at, updated_at
		FROM builder_images WHERE name = $1 AND tenant_id = $2`
	err := r.db.GetContext(ctx, &img, query, name, tenantID)
	if err != nil {
		return nil, fmt.Errorf("builder image not found: %w", err)
	}
	return &img, nil
}

func (r *BuildRepository) ListBuilderImages(ctx context.Context, tenantID string, filter models.ListBuilderImageFilter, offset, limit int) ([]models.BuilderImage, error) {
	var imgs []models.BuilderImage
	var conditions []string
	var args []interface{}
	argIdx := 1

	conditions = append(conditions, fmt.Sprintf("tenant_id = $%d", argIdx))
	args = append(args, tenantID)
	argIdx++

	if filter.Type != "" {
		conditions = append(conditions, fmt.Sprintf("type = $%d", argIdx))
		args = append(args, filter.Type)
		argIdx++
	}
	if filter.Status != "" {
		conditions = append(conditions, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, filter.Status)
		argIdx++
	}
	if filter.IsPreset != nil {
		conditions = append(conditions, fmt.Sprintf("is_preset = $%d", argIdx))
		args = append(args, *filter.IsPreset)
		argIdx++
	}

	where := "WHERE " + strings.Join(conditions, " AND ")
	query := fmt.Sprintf(`SELECT id, tenant_id, name, display_name, image, type, version, description,
		pull_policy, status, is_preset, env, labels, created_by, created_at, updated_at
		FROM builder_images %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, where, argIdx, argIdx+1)
	args = append(args, limit, offset)

	err := r.db.SelectContext(ctx, &imgs, query, args...)
	if err != nil {
		return nil, err
	}
	return imgs, nil
}

func (r *BuildRepository) UpdateBuilderImage(ctx context.Context, img *models.BuilderImage) error {
	query := `UPDATE builder_images SET display_name = $1, image = $2, type = $3, version = $4,
		description = $5, pull_policy = $6, status = $7, env = $8, labels = $9, updated_at = NOW()
		WHERE id = $10 AND tenant_id = $11`
	_, err := r.db.ExecContext(ctx, query,
		img.DisplayName, img.Image, img.Type, img.Version, img.Description, img.PullPolicy,
		img.Status, img.Env, img.Labels, img.ID, img.TenantID,
	)
	return err
}

func (r *BuildRepository) UpdateBuilderImageStatus(ctx context.Context, tenantID, id, status string) error {
	query := `UPDATE builder_images SET status = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`
	_, err := r.db.ExecContext(ctx, query, status, id, tenantID)
	return err
}

func (r *BuildRepository) DeleteBuilderImage(ctx context.Context, tenantID, id string) error {
	query := `DELETE FROM builder_images WHERE id = $1 AND tenant_id = $2`
	_, err := r.db.ExecContext(ctx, query, id, tenantID)
	return err
}

// ==================== Build Cache Config ====================

func (r *BuildRepository) CreateBuildCacheConfig(ctx context.Context, cfg *models.BuildCacheConfig) error {
	query := `INSERT INTO build_cache_configs (tenant_id, level, target_id, status, storage_type,
		storage_path, max_total_size, max_age_days, cleanup_policy, cache_key_pattern, cache_paths, description)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING id, created_at, updated_at`
	return r.db.QueryRowContext(ctx, query,
		cfg.TenantID, cfg.Level, cfg.TargetID, cfg.Status, cfg.StorageType,
		cfg.StoragePath, cfg.MaxTotalSize, cfg.MaxAgeDays, cfg.CleanupPolicy,
		cfg.CacheKeyPattern, cfg.CachePaths, cfg.Description,
	).Scan(&cfg.ID, &cfg.CreatedAt, &cfg.UpdatedAt)
}

func (r *BuildRepository) GetBuildCacheConfigByID(ctx context.Context, tenantID, id string) (*models.BuildCacheConfig, error) {
	var cfg models.BuildCacheConfig
	query := `SELECT id, tenant_id, level, target_id, status, storage_type, storage_path,
		max_total_size, max_age_days, cleanup_policy, cache_key_pattern, cache_paths, description,
		created_at, updated_at
		FROM build_cache_configs WHERE id = $1 AND tenant_id = $2`
	err := r.db.GetContext(ctx, &cfg, query, id, tenantID)
	if err != nil {
		return nil, fmt.Errorf("cache config not found: %w", err)
	}
	return &cfg, nil
}

func (r *BuildRepository) GetBuildCacheConfigByLevelAndTarget(ctx context.Context, tenantID, level, targetID string) (*models.BuildCacheConfig, error) {
	var cfg models.BuildCacheConfig
	var query string
	var args []interface{}
	if targetID != "" {
		query = `SELECT id, tenant_id, level, target_id, status, storage_type, storage_path,
			max_total_size, max_age_days, cleanup_policy, cache_key_pattern, cache_paths, description,
			created_at, updated_at
			FROM build_cache_configs WHERE tenant_id = $1 AND level = $2 AND target_id = $3`
		args = []interface{}{tenantID, level, targetID}
	} else {
		// Global level does not have target_id
		query = `SELECT id, tenant_id, level, target_id, status, storage_type, storage_path,
			max_total_size, max_age_days, cleanup_policy, cache_key_pattern, cache_paths, description,
			created_at, updated_at
			FROM build_cache_configs WHERE tenant_id = $1 AND level = $2 AND target_id IS NULL`
		args = []interface{}{tenantID, level}
	}
	err := r.db.GetContext(ctx, &cfg, query, args...)
	if err != nil {
		return nil, fmt.Errorf("cache config not found: %w", err)
	}
	return &cfg, nil
}

func (r *BuildRepository) ListBuildCacheConfigs(ctx context.Context, tenantID string, filter models.ListCacheConfigFilter, offset, limit int) ([]models.BuildCacheConfig, error) {
	var cfgs []models.BuildCacheConfig
	var conditions []string
	var args []interface{}
	argIdx := 1

	conditions = append(conditions, fmt.Sprintf("tenant_id = $%d", argIdx))
	args = append(args, tenantID)
	argIdx++

	if filter.Level != "" {
		conditions = append(conditions, fmt.Sprintf("level = $%d", argIdx))
		args = append(args, filter.Level)
		argIdx++
	}
	if filter.Status != "" {
		conditions = append(conditions, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, filter.Status)
		argIdx++
	}

	where := "WHERE " + strings.Join(conditions, " AND ")
	query := fmt.Sprintf(`SELECT id, tenant_id, level, target_id, status, storage_type, storage_path,
		max_total_size, max_age_days, cleanup_policy, cache_key_pattern, cache_paths, description,
		created_at, updated_at
		FROM build_cache_configs %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, where, argIdx, argIdx+1)
	args = append(args, limit, offset)

	err := r.db.SelectContext(ctx, &cfgs, query, args...)
	if err != nil {
		return nil, err
	}
	return cfgs, nil
}

func (r *BuildRepository) UpdateBuildCacheConfig(ctx context.Context, cfg *models.BuildCacheConfig) error {
	query := `UPDATE build_cache_configs SET status = $1, storage_type = $2, storage_path = $3,
		max_total_size = $4, max_age_days = $5, cleanup_policy = $6, cache_key_pattern = $7,
		cache_paths = $8, description = $9, updated_at = NOW()
		WHERE id = $10 AND tenant_id = $11`
	_, err := r.db.ExecContext(ctx, query,
		cfg.Status, cfg.StorageType, cfg.StoragePath,
		cfg.MaxTotalSize, cfg.MaxAgeDays, cfg.CleanupPolicy, cfg.CacheKeyPattern,
		cfg.CachePaths, cfg.Description, cfg.ID, cfg.TenantID,
	)
	return err
}

func (r *BuildRepository) DeleteBuildCacheConfig(ctx context.Context, tenantID, id string) error {
	query := `DELETE FROM build_cache_configs WHERE id = $1 AND tenant_id = $2`
	_, err := r.db.ExecContext(ctx, query, id, tenantID)
	return err
}
