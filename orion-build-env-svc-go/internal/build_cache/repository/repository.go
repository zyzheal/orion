package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"orion-build-env-svc-go/internal/models"
)

type BuildCacheConfigRepository struct {
	db *sqlx.DB
}

func NewBuildCacheConfigRepository(db *sqlx.DB) *BuildCacheConfigRepository {
	return &BuildCacheConfigRepository{db: db}
}

// CreateConfig creates a new cache config
func (r *BuildCacheConfigRepository) CreateConfig(ctx context.Context, tenantID string, cfg *models.BuildCacheConfig) error {
	cfg.ID = uuid.New().String()
	cfg.TenantID = tenantID
	cfg.CreatedAt = time.Now().UTC()
	cfg.UpdatedAt = time.Now().UTC()

	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO build_cache_config (id, tenant_id, name, level, status, config_data, created_at, updated_at)
		 VALUES (:id, :tenant_id, :name, :level, :status, :config_data, :created_at, :updated_at)`,
		cfg)
	if err != nil {
		return fmt.Errorf("failed to create cache config: %w", err)
	}
	return nil
}

// ListConfigs lists cache configs for a tenant
func (r *BuildCacheConfigRepository) ListConfigs(ctx context.Context, tenantID string, limit, offset int) ([]models.BuildCacheConfig, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.BuildCacheConfig
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, tenant_id, name, level, status, config_data, created_at, updated_at
		 FROM build_cache_config WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
		tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return items, nil
}

// GetConfig gets a cache config by ID
func (r *BuildCacheConfigRepository) GetConfig(ctx context.Context, tenantID, id string) (*models.BuildCacheConfig, error) {
	var cfg models.BuildCacheConfig
	err := r.db.GetContext(ctx, &cfg,
		`SELECT id, tenant_id, name, level, status, config_data, created_at, updated_at
		 FROM build_cache_config WHERE id = $1 AND tenant_id = $2`,
		id, tenantID)
	if err != nil {
		return nil, err
	}
	return &cfg, nil
}

// UpdateConfig updates a cache config
func (r *BuildCacheConfigRepository) UpdateConfig(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now().UTC()
	args := make([]interface{}, 0, len(updates)+2)
	setClauses := make([]string, 0, len(updates))
	for i, k := range getKeys(updates) {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", k, i+1))
		args = append(args, updates[k])
	}
	args = append(args, id, tenantID)

	_, err := r.db.ExecContext(ctx,
		fmt.Sprintf(`UPDATE build_cache_config SET %s WHERE id = $%d AND tenant_id = $%d`,
			joinStrings(setClauses, ", "), len(setClauses)+1, len(setClauses)+2),
		args...)
	if err != nil {
		return fmt.Errorf("failed to update cache config: %w", err)
	}
	return nil
}

// DeleteConfig deletes a cache config
func (r *BuildCacheConfigRepository) DeleteConfig(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM build_cache_config WHERE id = $1 AND tenant_id = $2`,
		id, tenantID)
	if err != nil {
		return fmt.Errorf("failed to delete cache config: %w", err)
	}
	return nil
}

type BuildCacheEntryRepository struct {
	db *sqlx.DB
}

func NewBuildCacheEntryRepository(db *sqlx.DB) *BuildCacheEntryRepository {
	return &BuildCacheEntryRepository{db: db}
}

func (r *BuildCacheEntryRepository) CreateEntry(ctx context.Context, tenantID string, entry *models.BuildCacheEntry) error {
	entry.ID = uuid.New().String()
	entry.TenantID = tenantID
	entry.CreatedAt = time.Now().UTC()

	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO build_cache_entry (id, tenant_id, pipeline_id, cache_key, data, created_at)
		 VALUES (:id, :tenant_id, :pipeline_id, :cache_key, :data, :created_at)`,
		entry)
	if err != nil {
		return fmt.Errorf("failed to create cache entry: %w", err)
	}
	return nil
}

func (r *BuildCacheEntryRepository) GetEntry(ctx context.Context, tenantID, cacheKey string) (*models.BuildCacheEntry, error) {
	var entry models.BuildCacheEntry
	err := r.db.GetContext(ctx, &entry,
		`SELECT id, tenant_id, pipeline_id, cache_key, data, created_at
		 FROM build_cache_entry WHERE cache_key = $1 AND tenant_id = $2`,
		cacheKey, tenantID)
	if err != nil {
		return nil, err
	}
	return &entry, nil
}

func (r *BuildCacheEntryRepository) DeleteEntry(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM build_cache_entry WHERE id = $1 AND tenant_id = $2`,
		id, tenantID)
	if err != nil {
		return fmt.Errorf("failed to delete cache entry: %w", err)
	}
	return nil
}

func getKeys(m map[string]interface{}) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

func joinStrings(strings []string, sep string) string {
	if len(strings) == 0 {
		return ""
	}
	result := strings[0]
	for _, s := range strings[1:] {
		result += sep + s
	}
	return result
}
