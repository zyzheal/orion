package repository

import (
	"context"
	"errors"
	"time"

	"orion/platform-svc-go/internal/cache-mgmt/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// Repository handles persistent storage for CacheConfig and CacheStats.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new repository backed by the given database.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- CacheConfig CRUD ---

// CreateConfig inserts a new cache configuration and assigns a UUID.
func (r *Repository) CreateConfig(ctx context.Context, cfg *models.CacheConfig) error {
	cfg.ID = uuid.New().String()
	cfg.CreatedAt = time.Now().UTC()
	cfg.UpdatedAt = time.Now().UTC()
	query := `INSERT INTO cache_configs (id, tenant_id, name, ttl, max_size, eviction, serializer, backend, enabled, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :ttl, :max_size, :eviction, :serializer, :backend, :enabled, :created_at, :updated_at)`
	_, err := r.db.NamedExecContext(ctx, query, cfg)
	return err
}

// GetConfigByID returns a cache config by its ID scoped to the tenant.
func (r *Repository) GetConfigByID(ctx context.Context, tenantID, id string) (*models.CacheConfig, error) {
	var cfg models.CacheConfig
	err := r.db.GetContext(ctx, &cfg,
		`SELECT * FROM cache_configs WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &cfg, nil
}

// ListConfigs returns cache configs for a tenant with pagination.
func (r *Repository) ListConfigs(ctx context.Context, tenantID string, limit, offset int) ([]models.CacheConfig, error) {
	if limit <= 0 {
		limit = 50
	}
	var configs []models.CacheConfig
	err := r.db.SelectContext(ctx, &configs,
		`SELECT * FROM cache_configs WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return configs, nil
}

// UpdateConfig updates fields of an existing cache config.
func (r *Repository) UpdateConfig(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	if len(updates) == 0 {
		return nil
	}
	updates["updated_at"] = time.Now().UTC()
	// Build SET clause dynamically from the updates map.
	namedKeys := make([]string, 0, len(updates))
	for k := range updates {
		namedKeys = append(namedKeys, k+"=:"+k)
	}
	setClause := ""
	for i, k := range namedKeys {
		if i > 0 {
			setClause += ","
		}
		setClause += k
	}
	query := "UPDATE cache_configs SET " + setClause + " WHERE id=:id AND tenant_id=:tenant_id"
	updates["id"] = id
	updates["tenant_id"] = tenantID
	_, err := r.db.NamedExecContext(ctx, query, updates)
	return err
}

// DeleteConfig removes a cache config by ID scoped to the tenant.
func (r *Repository) DeleteConfig(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM cache_configs WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// IsEnabled checks whether a cache config is enabled.
func (r *Repository) IsEnabled(ctx context.Context, id string) (bool, error) {
	var enabled bool
	err := r.db.GetContext(ctx, &enabled,
		`SELECT enabled FROM cache_configs WHERE id=$1`, id)
	if err != nil {
		return false, err
	}
	return enabled, nil
}

// GetConfigStatsForUpdate atomically reads a config to return its fields
// (TTL, MaxSize, Eviction, Serializer, Backend, Enabled) to the service layer.
func (r *Repository) GetConfigStatsForUpdate(ctx context.Context, tenantID, id string) (*models.CacheConfig, error) {
	return r.GetConfigByID(ctx, tenantID, id)
}

// --- CacheStats CRUD ---

// UpsertStats inserts or updates statistics for a cache key.
func (r *Repository) UpsertStats(ctx context.Context, stats *models.CacheStats) error {
	if stats.ID == "" {
		stats.ID = uuid.New().String()
	}
	stats.LastAccess = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO cache_stats (id, config_id, key, hits, misses, evictions, avg_ttl, last_access)
		 VALUES (:id, :config_id, :key, :hits, :misses, :evictions, :avg_ttl, :last_access)
		ON CONFLICT (config_id, key) DO UPDATE SET
		 hits=cache_stats.hits+EXCLUDED.hits,
		 misses=cache_stats.misses+EXCLUDED.misses,
		 evictions=cache_stats.evictions+EXCLUDED.evictions,
		 avg_ttl=EXCLUDED.avg_ttl,
		 last_access=EXCLUDED.last_access`,
		stats)
	return err
}

// GetStatsByConfig returns all stats rows for a given config.
func (r *Repository) GetStatsByConfig(ctx context.Context, configID string) ([]models.CacheStats, error) {
	var stats []models.CacheStats
	err := r.db.SelectContext(ctx, &stats,
		`SELECT * FROM cache_stats WHERE config_id=$1 ORDER BY last_access DESC`, configID)
	if err != nil {
		return nil, err
	}
	return stats, nil
}

// GetStatsByKey returns the stats row for a specific config+key.
func (r *Repository) GetStatsByKey(ctx context.Context, configID, key string) (*models.CacheStats, error) {
	var s models.CacheStats
	err := r.db.GetContext(ctx, &s,
		`SELECT * FROM cache_stats WHERE config_id=$1 AND key=$2`, configID, key)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// DeleteStatsByConfig removes all stats rows for a config.
func (r *Repository) DeleteStatsByConfig(ctx context.Context, configID string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM cache_stats WHERE config_id=$1`, configID)
	return err
}

// --- Sentinel errors ---

var ErrConfigNotFound = errors.New("cache config not found")
