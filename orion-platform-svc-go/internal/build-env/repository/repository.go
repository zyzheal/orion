package repository

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/build-env/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- Build CRUD ---

func (r *Repository) CreateBuild(ctx context.Context, m *models.Build) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = time.Now().UTC()
	query := `INSERT INTO builds (id, tenant_id, name, status, pipeline_id, product_line_id, created_at, updated_at)
			VALUES (:id, :tenant_id, :name, :status, :pipeline_id, :product_line_id, :created_at, :updated_at)`
	_, err := r.db.NamedExecContext(ctx, query, m)
	return err
}

func (r *Repository) GetBuild(ctx context.Context, tenantID, id string) (*models.Build, error) {
	var m models.Build
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM builds WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) ListBuilds(ctx context.Context, tenantID string, limit, offset int) ([]models.Build, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.Build
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM builds WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) UpdateBuild(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`UPDATE builds SET updated_at = NOW() WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) DeleteBuild(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM builds WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// --- Build Image CRUD ---

func (r *Repository) CreateBuildImage(ctx context.Context, m *models.BuildImage) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = time.Now().UTC()
	query := `INSERT INTO build_images (id, tenant_id, name, image_tag, base_image, dockerfile, created_at, updated_at)
			VALUES (:id, :tenant_id, :name, :image_tag, :base_image, :dockerfile, :created_at, :updated_at)`
	_, err := r.db.NamedExecContext(ctx, query, m)
	return err
}

func (r *Repository) GetBuildImage(ctx context.Context, tenantID, id string) (*models.BuildImage, error) {
	var m models.BuildImage
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM build_images WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) ListBuildImages(ctx context.Context, tenantID string, limit, offset int) ([]models.BuildImage, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.BuildImage
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM build_images WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) UpdateBuildImage(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE build_images SET updated_at = NOW() WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) DeleteBuildImage(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM build_images WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// --- Build Cache Config CRUD ---

func (r *Repository) CreateCacheConfig(ctx context.Context, tenantID string, name string, level string, status string, cacheDir string, ttlHours int) (*models.BuildCacheConfig, error) {
	var config models.BuildCacheConfig
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO build_cache_configs (tenant_id, name, level, status, cache_dir, ttl_hours, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
			RETURNING id, tenant_id, name, level, status, cache_dir, ttl_hours, created_at, updated_at`,
		tenantID, name, level, status, cacheDir, ttlHours).Scan(
		&config.ID, &config.TenantID, &config.Name, &config.Level, &config.Status,
		&config.CacheDir, &config.TTLHours, &config.CreatedAt, &config.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &config, nil
}

func (r *Repository) GetCacheConfig(ctx context.Context, tenantID string, id int) (*models.BuildCacheConfig, error) {
	var config models.BuildCacheConfig
	err := r.db.GetContext(ctx, &config,
		`SELECT * FROM build_cache_configs WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &config, nil
}

func (r *Repository) ListCacheConfigs(ctx context.Context, tenantID, level, status string, limit, offset int) ([]models.BuildCacheConfig, error) {
	if limit <= 0 {
		limit = 50
	}
	var sql string
	var args []interface{}

	if level != "" && status != "" {
		sql = `SELECT * FROM build_cache_configs WHERE tenant_id=$1 AND level=$2 AND status=$3 ORDER BY created_at DESC LIMIT $4 OFFSET $5`
		args = []interface{}{tenantID, level, status, limit, offset}
	} else if level != "" {
		sql = `SELECT * FROM build_cache_configs WHERE tenant_id=$1 AND level=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`
		args = []interface{}{tenantID, level, limit, offset}
	} else if status != "" {
		sql = `SELECT * FROM build_cache_configs WHERE tenant_id=$1 AND status=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`
		args = []interface{}{tenantID, status, limit, offset}
	} else {
		sql = `SELECT * FROM build_cache_configs WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`
		args = []interface{}{tenantID, limit, offset}
	}

	var items []models.BuildCacheConfig
	err := r.db.SelectContext(ctx, &items, sql, args...)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) UpdateCacheConfig(ctx context.Context, tenantID string, id int, updates map[string]interface{}) (*models.BuildCacheConfig, error) {
	_, err := r.db.ExecContext(ctx,
		`UPDATE build_cache_configs SET updated_at = NOW() WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return r.GetCacheConfig(ctx, tenantID, id)
}

func (r *Repository) DeleteCacheConfig(ctx context.Context, tenantID string, id int) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM build_cache_configs WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// --- Build Log CRUD ---

func (r *Repository) CreateBuildLog(ctx context.Context, tenantID, buildID, logData string) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO build_logs (tenant_id, build_id, log_data, created_at)
			VALUES ($1, $2, $3, NOW())`, tenantID, buildID, logData)
	return err
}

func (r *Repository) GetBuildLog(ctx context.Context, tenantID string, id int) (*models.BuildLog, error) {
	var log models.BuildLog
	err := r.db.GetContext(ctx, &log,
		`SELECT * FROM build_logs WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &log, nil
}

func (r *Repository) ListBuildLogs(ctx context.Context, tenantID string, limit, offset int) ([]models.BuildLog, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.BuildLog
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM build_logs WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return items, nil
}

// --- Cache Monitor ---

func (r *Repository) GetCacheDashboard(ctx context.Context, tenantID string) (*models.CacheDashboard, error) {
	d := &models.CacheDashboard{}
	err := r.db.GetContext(ctx, d,
		`SELECT COUNT(*) AS total_configs,
		        COUNT(*) FILTER (WHERE status='active') AS active_configs,
		        0.0 AS cache_hit_rate,
		        0.0 AS avg_latency_ms
		 FROM build_cache_configs WHERE tenant_id=$1`, tenantID)
	return d, err
}

func (r *Repository) GetCacheMetrics(ctx context.Context, tenantID string, cacheID string) (*models.CacheMetrics, error) {
	var metrics models.CacheMetrics
	err := r.db.GetContext(ctx, &metrics,
		`SELECT 0 AS hits, 0 AS misses, 0.0 AS hit_rate, 0.0 AS avg_latency_ms`)
	if err != nil {
		return nil, err
	}
	metrics.CacheID = cacheID
	return &metrics, nil
}

func (r *Repository) AssessCacheHealth(ctx context.Context, tenantID string, cacheID string) (*models.CacheHealth, error) {
	return &models.CacheHealth{
		CacheID:   cacheID,
		Healthy:   true,
		LastCheck: time.Now().UTC(),
	}, nil
}

func (r *Repository) RecordCacheEvent(ctx context.Context, tenantID, cacheID, eventType string, latencySavedMs *float64) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO cache_events (tenant_id, cache_id, event_type, latency_saved_ms, created_at)
			VALUES ($1, $2, $3, $4, NOW())`, tenantID, cacheID, eventType, latencySavedMs)
	return err
}

func (r *Repository) AnalyzePerformanceImpact(ctx context.Context, tenantID, pipelineID string) (*models.CachePerformanceImpact, error) {
	return &models.CachePerformanceImpact{
		PipelineID: pipelineID,
	}, nil
}

// NotYetImplemented is a sentinel error for features not yet backed by a DB table.
func NotYetImplemented(msg string) error {
	return fmt.Errorf("%s", msg)
}
