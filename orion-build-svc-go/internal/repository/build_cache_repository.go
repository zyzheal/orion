package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"orion/build-svc-go/internal/models"
	"orion/go-common/pkg/database"
)

// BuildCacheConfigRepository handles database operations for build cache configs.
type BuildCacheConfigRepository struct {
	db *database.DB
}

func NewBuildCacheConfigRepository(db *database.DB) *BuildCacheConfigRepository {
	return &BuildCacheConfigRepository{db: db}
}

func (r *BuildCacheConfigRepository) Create(ctx context.Context, cfg *models.BuildCacheConfig) error {
	query := `INSERT INTO build_cache_configs (level, target_id, status, storage_type, storage_path,
		max_total_size, max_age_days, cleanup_policy, cache_key_pattern, cache_paths, description)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id, created_at`
	return r.db.QueryRowContext(ctx, query,
		cfg.Level, cfg.TargetID, cfg.Status, cfg.StorageType, cfg.StoragePath,
		cfg.MaxTotalSize, cfg.MaxAgeDays, cfg.CleanupPolicy, cfg.CacheKeyPattern, cfg.CachePaths, cfg.Description,
	).Scan(&cfg.ID, &cfg.CreatedAt)
}

func (r *BuildCacheConfigRepository) GetByID(ctx context.Context, id string) (*models.BuildCacheConfig, error) {
	var cfg models.BuildCacheConfig
	err := r.db.GetContext(ctx, &cfg,
		`SELECT id, level, target_id, status, storage_type, storage_path,
			max_total_size, max_age_days, cleanup_policy, cache_key_pattern, cache_paths,
			description, created_at, updated_at FROM build_cache_configs WHERE id = $1`, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("cache config not found: %w", err)
	}
	return &cfg, nil
}

func (r *BuildCacheConfigRepository) FindByLevelAndTarget(ctx context.Context, level models.CacheLevel, targetID string) (*models.BuildCacheConfig, error) {
	var cfg models.BuildCacheConfig
	err := r.db.GetContext(ctx, &cfg,
		`SELECT id, level, target_id, status, storage_type, storage_path,
			max_total_size, max_age_days, cleanup_policy, cache_key_pattern, cache_paths,
			description, created_at, updated_at FROM build_cache_configs
			WHERE level = $1 AND (target_id = $2 OR (target_id IS NULL AND $2 = ''))`, string(level), targetID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("cache config lookup failed: %w", err)
	}
	return &cfg, nil
}

func (r *BuildCacheConfigRepository) FindAllWithFilters(ctx context.Context, opts models.ListCacheConfigsOptions) ([]models.BuildCacheConfig, error) {
	var conditions []string
	var args []interface{}
	argIdx := 1

	conditions = append(conditions, fmt.Sprintf("level = $%d", argIdx))
	args = append(args, opts.Level)
	argIdx++

	conditions = append(conditions, fmt.Sprintf("status = $%d", argIdx))
	args = append(args, opts.Status)
	argIdx++

	where := ""
	if len(conditions) > 0 {
		where = "WHERE " + strings.Join(conditions, " AND ")
	}

	limit := opts.Limit
	if limit <= 0 {
		limit = 100
	}

	query := fmt.Sprintf(`SELECT id, level, target_id, status, storage_type, storage_path,
		max_total_size, max_age_days, cleanup_policy, cache_key_pattern, cache_paths,
		description, created_at, updated_at FROM build_cache_configs %s ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d`, where, argIdx, argIdx+1)
	args = append(args, limit, opts.Offset)

	var configs []models.BuildCacheConfig
	err := r.db.SelectContext(ctx, &configs, query, args...)
	if err != nil {
		return nil, err
	}
	return configs, nil
}

func (r *BuildCacheConfigRepository) Update(ctx context.Context, cfg *models.BuildCacheConfig) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE build_cache_configs SET status = $1, storage_type = $2, storage_path = $3,
			max_total_size = $4, max_age_days = $5, cleanup_policy = $6, cache_key_pattern = $7,
			cache_paths = $8, description = $9, updated_at = NOW() WHERE id = $10`,
		cfg.Status, cfg.StorageType, cfg.StoragePath, cfg.MaxTotalSize, cfg.MaxAgeDays,
		cfg.CleanupPolicy, cfg.CacheKeyPattern, cfg.CachePaths, cfg.Description, cfg.ID)
	return err
}

func (r *BuildCacheConfigRepository) Delete(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM build_cache_configs WHERE id = $1`, id)
	return err
}

// ==================== Cache Entry ====================

// BuildCacheEntryRepository handles database operations for cache entries.
type BuildCacheEntryRepository struct {
	db *database.DB
}

func NewBuildCacheEntryRepository(db *database.DB) *BuildCacheEntryRepository {
	return &BuildCacheEntryRepository{db: db}
}

func (r *BuildCacheEntryRepository) Create(ctx context.Context, entry *models.CacheEntry) error {
	query := `INSERT INTO cache_entries (config_id, cache_key, hash, size, storage_path,
		hit_count, last_hit_at, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at`
	return r.db.QueryRowContext(ctx, query,
		entry.ConfigID, entry.CacheKey, entry.Hash, entry.Size, entry.StoragePath,
		0, entry.LastHitAt, entry.ExpiresAt,
	).Scan(&entry.ID, &entry.CreatedAt)
}

func (r *BuildCacheEntryRepository) GetByID(ctx context.Context, id string) (*models.CacheEntry, error) {
	var entry models.CacheEntry
	err := r.db.GetContext(ctx, &entry,
		`SELECT id, config_id, cache_key, hash, size, storage_path, hit_count,
			last_hit_at, expires_at, created_at, updated_at FROM cache_entries WHERE id = $1`, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("cache entry not found: %w", err)
	}
	return &entry, nil
}

func (r *BuildCacheEntryRepository) FindByCacheKey(ctx context.Context, configID, cacheKey string) (*models.CacheEntry, error) {
	var entry models.CacheEntry
	err := r.db.GetContext(ctx, &entry,
		`SELECT id, config_id, cache_key, hash, size, storage_path, hit_count,
			last_hit_at, expires_at, created_at, updated_at FROM cache_entries
			WHERE config_id = $1 AND cache_key = $2 AND (expires_at IS NULL OR expires_at > NOW())`,
		configID, cacheKey)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("cache entry lookup failed: %w", err)
	}
	return &entry, nil
}

func (r *BuildCacheEntryRepository) FindByConfigID(ctx context.Context, configID string, offset, limit int) ([]models.CacheEntry, error) {
	limit = limitOrDefault(limit, 100)
	var entries []models.CacheEntry
	err := r.db.SelectContext(ctx, &entries,
		`SELECT id, config_id, cache_key, hash, size, storage_path, hit_count,
			last_hit_at, expires_at, created_at, updated_at FROM cache_entries
			WHERE config_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
		configID, limit, offset)
	return entries, err
}

func (r *BuildCacheEntryRepository) FindAllWithFilter(ctx context.Context, offset, limit int) ([]models.CacheEntry, error) {
	limit = limitOrDefault(limit, 100)
	var entries []models.CacheEntry
	err := r.db.SelectContext(ctx, &entries,
		`SELECT id, config_id, cache_key, hash, size, storage_path, hit_count,
			last_hit_at, expires_at, created_at, updated_at FROM cache_entries
			ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
		limit, offset)
	return entries, err
}

func (r *BuildCacheEntryRepository) RecordHit(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE cache_entries SET hit_count = hit_count + 1, last_hit_at = NOW(), updated_at = NOW()
			WHERE id = $1`, id)
	return err
}

func (r *BuildCacheEntryRepository) FindLRUEntries(ctx context.Context, configID string) ([]models.CacheEntry, error) {
	var entries []models.CacheEntry
	err := r.db.SelectContext(ctx, &entries,
		`SELECT id, config_id, cache_key, hash, size, storage_path, hit_count,
			last_hit_at, expires_at, created_at, updated_at FROM cache_entries
			WHERE config_id = $1 ORDER BY last_hit_at ASC`, configID)
	return entries, err
}

func (r *BuildCacheEntryRepository) DeleteExpired(ctx context.Context) (int, error) {
	result, err := r.db.ExecContext(ctx, `DELETE FROM cache_entries WHERE expires_at IS NOT NULL AND expires_at < NOW()`)
	if err != nil {
		return 0, err
	}
	rows, _ := result.RowsAffected()
	return int(rows), nil
}

func (r *BuildCacheEntryRepository) DeleteByConfigID(ctx context.Context, configID string) (int, error) {
	result, err := r.db.ExecContext(ctx, `DELETE FROM cache_entries WHERE config_id = $1`, configID)
	if err != nil {
		return 0, err
	}
	rows, _ := result.RowsAffected()
	return int(rows), nil
}

func (r *BuildCacheEntryRepository) Delete(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM cache_entries WHERE id = $1`, id)
	return err
}
