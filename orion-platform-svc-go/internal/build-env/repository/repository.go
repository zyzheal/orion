package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/build-env/models"
)

// Repository persists build-env records.
//
// Every SELECT lists its columns by name instead of using SELECT *. sqlx's
// default mapper is strict: with no destination field for a source column it
// returns "missing destination name X in Row.Scan" rather than dropping the
// column. Migration 016's own "补齐 builds" ALTER adds 14 columns to builds
// that models.Build does not know about, and 571/572 add deleted_at,
// created_by and updated_by to build_images, build_cache_configs and
// build_logs. So SELECT * turned all eight read endpoints into 500s on any
// database migrated past 016 — the columns below are exactly the ones each
// model maps, and nothing more.
type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// SELECT lists, shared by the get and list methods of each table.
const (
	buildCols  = `id, tenant_id, name, status, pipeline_id, product_line_id, created_at, updated_at`
	imageCols  = `id, tenant_id, name, image_tag, base_image, dockerfile, created_at, updated_at`
	configCols = `id, tenant_id, name, level, status, cache_dir, ttl_hours, created_at, updated_at`
	logCols    = `id, tenant_id, build_id, log_data, created_at`
)

// Update whitelists. Only the columns the request models expose are settable,
// and only through this table: the update statements are rendered from caller
// input, so the column names come from a constant set rather than from the map
// keys. Values are always bound as arguments.
var (
	buildUpdatable = map[string]bool{
		"name": true, "status": true, "pipeline_id": true, "product_line_id": true,
	}
	imageUpdatable = map[string]bool{
		"name": true, "image_tag": true, "base_image": true, "dockerfile": true,
	}
	configUpdatable = map[string]bool{
		"name": true, "level": true, "status": true, "cache_dir": true, "ttl_hours": true,
	}
)

// setClause renders an updates map as a SQL SET list, dropping keys that are
// not in allowed and sorting the rest so the rendered statement is stable
// across map iterations. It returns (setList, boundArgs, columnCount); an
// empty columnCount means the caller asked for an update with no fields.
//
// Updated_at is appended rather than taken from the map, so a caller cannot
// write it explicitly and the map is never mutated in place — the old code did
// updates["updated_at"] = time.Now() and then discarded the map entirely.
func setClause(updates map[string]interface{}, allowed map[string]bool) (string, []interface{}, int) {
	keys := make([]string, 0, len(updates))
	for k := range updates {
		if allowed[k] {
			keys = append(keys, k)
		}
	}
	if len(keys) == 0 {
		return "", nil, 0
	}
	sort.Strings(keys)

	parts := make([]string, 0, len(keys)+1)
	args := make([]interface{}, 0, len(keys)+1)
	for i, k := range keys {
		parts = append(parts, fmt.Sprintf("%s=$%d", k, i+1))
		args = append(args, updates[k])
	}
	parts = append(parts, "updated_at=NOW()")
	return strings.Join(parts, ", "), args, len(keys)
}

// requireRow turns a zero-row write into sentinel.NotFound.
//
// These statements are keyed on id AND tenant_id, so zero affected rows means
// either "no such id" or "an id that belongs to another tenant". Reporting that
// as success made DELETE /build-env/builds/:id answer 204 for a guessed foreign
// UUID, and every update silently claimed it had applied.
func requireRow(result sql.Result, what string) error {
	n, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return fmt.Errorf("%s not found: %w", what, sentinel.NotFound)
	}
	return nil
}

// notFound maps sqlx's sql.ErrNoRows to sentinel.NotFound. The handlers already
// branch on service.IsNotFound, which checks sentinel.NotFound — but the
// repository returned the raw driver error, so that branch was dead and every
// missing id surfaced as a 500 with a database error string.
func notFound(what, id string, err error) error {
	if errors.Is(err, sql.ErrNoRows) {
		return fmt.Errorf("%s %s not found: %w", what, id, sentinel.NotFound)
	}
	return err
}

// --- Build CRUD ---

func (r *Repository) CreateBuild(ctx context.Context, m *models.Build) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = m.CreatedAt
	query := `INSERT INTO builds (id, tenant_id, name, status, pipeline_id, product_line_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`
	_, err := r.db.ExecContext(ctx, query, m.ID, m.TenantID, m.Name, m.Status, m.PipelineID, m.ProductLineID, m.CreatedAt, m.UpdatedAt)
	return err
}

func (r *Repository) GetBuild(ctx context.Context, tenantID, id string) (*models.Build, error) {
	var m models.Build
	err := r.db.GetContext(ctx, &m,
		fmt.Sprintf(`SELECT %s FROM builds WHERE id=$1 AND tenant_id=$2`, buildCols), id, tenantID)
	if err != nil {
		return nil, notFound("build", id, err)
	}
	return &m, nil
}

func (r *Repository) ListBuilds(ctx context.Context, tenantID string, limit, offset int) ([]models.Build, error) {
	if limit <= 0 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}
	var items []models.Build
	err := r.db.SelectContext(ctx, &items,
		fmt.Sprintf(`SELECT %s FROM builds WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, buildCols),
		tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) UpdateBuild(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	set, args, n := setClause(updates, buildUpdatable)
	if n == 0 {
		return fmt.Errorf("update build: %w", sentinel.BadRequest)
	}
	args = append(args, id, tenantID)
	result, err := r.db.ExecContext(ctx,
		fmt.Sprintf(`UPDATE builds SET %s WHERE id=$%d AND tenant_id=$%d`, set, n+1, n+2), args...)
	if err != nil {
		return fmt.Errorf("update build: %w", err)
	}
	if err := requireRow(result, "build"); err != nil {
		return err
	}
	return nil
}

func (r *Repository) DeleteBuild(ctx context.Context, tenantID, id string) error {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM builds WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return fmt.Errorf("delete build: %w", err)
	}
	return requireRow(result, "build")
}

// --- Build Image CRUD ---

func (r *Repository) CreateBuildImage(ctx context.Context, m *models.BuildImage) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = m.CreatedAt
	query := `INSERT INTO build_images (id, tenant_id, name, image_tag, base_image, dockerfile, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`
	_, err := r.db.ExecContext(ctx, query, m.ID, m.TenantID, m.Name, m.ImageTag, m.BaseImage, m.Dockerfile, m.CreatedAt, m.UpdatedAt)
	return err
}

func (r *Repository) GetBuildImage(ctx context.Context, tenantID, id string) (*models.BuildImage, error) {
	var m models.BuildImage
	err := r.db.GetContext(ctx, &m,
		fmt.Sprintf(`SELECT %s FROM build_images WHERE id=$1 AND tenant_id=$2`, imageCols), id, tenantID)
	if err != nil {
		return nil, notFound("build image", id, err)
	}
	return &m, nil
}

func (r *Repository) ListBuildImages(ctx context.Context, tenantID string, limit, offset int) ([]models.BuildImage, error) {
	if limit <= 0 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}
	var items []models.BuildImage
	err := r.db.SelectContext(ctx, &items,
		fmt.Sprintf(`SELECT %s FROM build_images WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, imageCols),
		tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) UpdateBuildImage(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	set, args, n := setClause(updates, imageUpdatable)
	if n == 0 {
		return fmt.Errorf("update build image: %w", sentinel.BadRequest)
	}
	args = append(args, id, tenantID)
	result, err := r.db.ExecContext(ctx,
		fmt.Sprintf(`UPDATE build_images SET %s WHERE id=$%d AND tenant_id=$%d`, set, n+1, n+2), args...)
	if err != nil {
		return fmt.Errorf("update build image: %w", err)
	}
	if err := requireRow(result, "build image"); err != nil {
		return err
	}
	return nil
}

func (r *Repository) DeleteBuildImage(ctx context.Context, tenantID, id string) error {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM build_images WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return fmt.Errorf("delete build image: %w", err)
	}
	return requireRow(result, "build image")
}

// --- Build Cache Config CRUD ---

func (r *Repository) CreateCacheConfig(ctx context.Context, tenantID string, name string, level string, status string, cacheDir string, ttlHours int) (*models.BuildCacheConfig, error) {
	var config models.BuildCacheConfig
	query := fmt.Sprintf(`INSERT INTO build_cache_configs (tenant_id, name, level, status, cache_dir, ttl_hours, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
		RETURNING %s`, configCols)
	err := r.db.GetContext(ctx, &config, query, tenantID, name, level, status, cacheDir, ttlHours)
	if err != nil {
		return nil, fmt.Errorf("create cache config: %w", err)
	}
	return &config, nil
}

func (r *Repository) GetCacheConfig(ctx context.Context, tenantID string, id string) (*models.BuildCacheConfig, error) {
	var config models.BuildCacheConfig
	err := r.db.GetContext(ctx, &config,
		fmt.Sprintf(`SELECT %s FROM build_cache_configs WHERE id=$1 AND tenant_id=$2`, configCols), id, tenantID)
	if err != nil {
		return nil, notFound("cache config", id, err)
	}
	return &config, nil
}

func (r *Repository) ListCacheConfigs(ctx context.Context, tenantID, level, status string, limit, offset int) ([]models.BuildCacheConfig, error) {
	if limit <= 0 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}
	preds := []string{"tenant_id=$1"}
	args := []interface{}{tenantID}
	argIdx := 2
	if level != "" {
		preds = append(preds, fmt.Sprintf("level=$%d", argIdx))
		args = append(args, level)
		argIdx++
	}
	if status != "" {
		preds = append(preds, fmt.Sprintf("status=$%d", argIdx))
		args = append(args, status)
		argIdx++
	}
	args = append(args, limit, offset)

	query := fmt.Sprintf(`SELECT %s FROM build_cache_configs WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
		configCols, strings.Join(preds, " AND "), argIdx, argIdx+1)

	var items []models.BuildCacheConfig
	err := r.db.SelectContext(ctx, &items, query, args...)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) UpdateCacheConfig(ctx context.Context, tenantID string, id string, updates map[string]interface{}) (*models.BuildCacheConfig, error) {
	set, args, n := setClause(updates, configUpdatable)
	if n == 0 {
		return nil, fmt.Errorf("update cache config: %w", sentinel.BadRequest)
	}
	args = append(args, id, tenantID)
	result, err := r.db.ExecContext(ctx,
		fmt.Sprintf(`UPDATE build_cache_configs SET %s WHERE id=$%d AND tenant_id=$%d`, set, n+1, n+2), args...)
	if err != nil {
		return nil, fmt.Errorf("update cache config: %w", err)
	}
	if err := requireRow(result, "cache config"); err != nil {
		return nil, err
	}
	// The row that was written, re-read through the tenant-scoped lookup. The
	// previous version re-read the row it had just failed to change.
	return r.GetCacheConfig(ctx, tenantID, id)
}

func (r *Repository) DeleteCacheConfig(ctx context.Context, tenantID string, id string) error {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM build_cache_configs WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return fmt.Errorf("delete cache config: %w", err)
	}
	return requireRow(result, "cache config")
}

// --- Build Log CRUD ---

func (r *Repository) GetBuildLog(ctx context.Context, tenantID string, id string) (*models.BuildLog, error) {
	var log models.BuildLog
	err := r.db.GetContext(ctx, &log,
		fmt.Sprintf(`SELECT %s FROM build_logs WHERE id=$1 AND tenant_id=$2`, logCols), id, tenantID)
	if err != nil {
		return nil, notFound("build log", id, err)
	}
	return &log, nil
}

func (r *Repository) ListBuildLogs(ctx context.Context, tenantID string, limit, offset int) ([]models.BuildLog, error) {
	if limit <= 0 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}
	var items []models.BuildLog
	err := r.db.SelectContext(ctx, &items,
		fmt.Sprintf(`SELECT %s FROM build_logs WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, logCols),
		tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return items, nil
}

// --- Cache monitor ---
//
// healthThresholdHitRate and healthStaleAfter define the two conditions a cache
// can fail on. They are named rather than inlined so the health contract is
// visible in one place and testable without a database.
const (
	healthThresholdHitRate = 0.50
	healthStaleAfter       = 7 * 24 * time.Hour
)

// probesCount and hitRate are the two aggregate expressions the metrics and
// health queries share. A probe is a hit or a miss; an evict records that
// something left the cache and says nothing about whether lookups succeed.
const (
	probesCount = `COUNT(*) FILTER (WHERE event_type IN ('hit', 'miss'))`
	hitCount    = `COUNT(*) FILTER (WHERE event_type = 'hit')`
)

// GetCacheDashboard returns the tenant-wide cache summary. The two telemetry
// fields are null when there are no probes, so a tenant with configured caches
// but no recorded traffic reads as "no data" rather than a 0% hit rate.
func (r *Repository) GetCacheDashboard(ctx context.Context, tenantID string) (*models.CacheDashboard, error) {
	query := `WITH probes AS (
	SELECT ` + probesCount + ` AS n, ` + hitCount + ` AS hits
	FROM cache_events WHERE tenant_id = $1
)
SELECT COUNT(*) AS total_configs,
	COUNT(*) FILTER (WHERE bc.status = 'active') AS active_configs,
	CASE WHEN p.n = 0 THEN NULL ELSE 1.0 * p.hits / p.n END AS cache_hit_rate,
	(SELECT AVG(ce.latency_saved_ms) FROM cache_events ce
	    WHERE ce.tenant_id = $1 AND ce.event_type = 'hit') AS avg_latency_ms
FROM build_cache_configs bc
CROSS JOIN probes p
WHERE bc.tenant_id = $1`

	var row struct {
		TotalConfigs  int             `db:"total_configs"`
		ActiveConfigs int             `db:"active_configs"`
		HitRate       sql.NullFloat64 `db:"cache_hit_rate"`
		AvgLatencyMs  sql.NullFloat64 `db:"avg_latency_ms"`
	}
	if err := r.db.GetContext(ctx, &row, query, tenantID); err != nil {
		return nil, fmt.Errorf("get cache dashboard: %w", err)
	}
	d := &models.CacheDashboard{TotalConfigs: row.TotalConfigs, ActiveConfigs: row.ActiveConfigs}
	if row.HitRate.Valid {
		v := row.HitRate.Float64
		d.CacheHitRate = &v
	}
	if row.AvgLatencyMs.Valid {
		v := row.AvgLatencyMs.Float64
		d.AvgLatencyMs = &v
	}
	return d, nil
}

// GetCacheMetrics returns the per-cache counters. The old version ran
// SELECT 0 AS hits, 0 AS misses, 0.0 AS hit_rate, 0.0 AS avg_latency_ms with no
// FROM clause at all, so it ignored both of its parameters and answered with
// zeros for every cache, including every cache that did not exist.
func (r *Repository) GetCacheMetrics(ctx context.Context, tenantID string, cacheID string) (*models.CacheMetrics, error) {
	var row struct {
		Hits         int             `db:"hits"`
		Misses       int             `db:"misses"`
		HitRate      float64         `db:"hit_rate"`
		AvgLatencyMs sql.NullFloat64 `db:"avg_latency_ms"`
	}
	err := r.db.QueryRowContext(ctx,
		`SELECT `+hitCount+` AS hits,
			COUNT(*) FILTER (WHERE event_type = 'miss') AS misses,
			CASE WHEN `+probesCount+` = 0 THEN 0
			     ELSE 1.0 * `+hitCount+` / `+probesCount+` END AS hit_rate,
			AVG(latency_saved_ms) FILTER (WHERE event_type = 'hit') AS avg_latency_ms
		 FROM cache_events WHERE tenant_id=$1 AND cache_id=$2`, tenantID, cacheID).
		Scan(&row.Hits, &row.Misses, &row.HitRate, &row.AvgLatencyMs)
	if err != nil {
		return nil, fmt.Errorf("get cache metrics: %w", err)
	}
	m := &models.CacheMetrics{CacheID: cacheID, Hits: row.Hits, Misses: row.Misses, HitRate: row.HitRate}
	if row.AvgLatencyMs.Valid {
		v := row.AvgLatencyMs.Float64
		m.AvgLatencyMs = &v
	}
	return m, nil
}

// AssessCacheHealth decides whether a cache is worth keeping warm.
//
// Unhealthy when it has no probe traffic (nothing to assess), when its hit rate
// is below healthThresholdHitRate, or when its most recent probe is older than
// healthStaleAfter. Each case reports its own reason, and Healthy is false in
// all three — the previous version returned Healthy: true unconditionally, so a
// cache that had never been probed reported as healthy.
func (r *Repository) AssessCacheHealth(ctx context.Context, tenantID string, cacheID string) (*models.CacheHealth, error) {
	var row struct {
		Probes    int          `db:"probes"`
		HitRate   float64      `db:"hit_rate"`
		LastProbe sql.NullTime `db:"last_probe"`
	}
	err := r.db.QueryRowContext(ctx,
		`SELECT `+probesCount+` AS probes,
			CASE WHEN `+probesCount+` = 0 THEN 0
			     ELSE 1.0 * `+hitCount+` / `+probesCount+` END AS hit_rate,
			MAX(created_at) FILTER (WHERE event_type IN ('hit', 'miss')) AS last_probe
		 FROM cache_events WHERE tenant_id=$1 AND cache_id=$2`, tenantID, cacheID).
		Scan(&row.Probes, &row.HitRate, &row.LastProbe)
	if err != nil {
		return nil, fmt.Errorf("assess cache health: %w", err)
	}

	health := &models.CacheHealth{CacheID: cacheID, LastCheck: time.Now().UTC()}
	if row.Probes == 0 {
		health.Healthy = false
		health.Reason = "no cache events recorded: health cannot be assessed"
		return health, nil
	}
	if row.HitRate < healthThresholdHitRate {
		health.Healthy = false
		health.Reason = fmt.Sprintf("hit rate %.2f is below the %.2f threshold", row.HitRate, healthThresholdHitRate)
		return health, nil
	}
	if row.LastProbe.Valid && time.Since(row.LastProbe.Time.UTC()) > healthStaleAfter {
		health.Healthy = false
		health.Reason = fmt.Sprintf("last probe was %s ago, outside the %s freshness window",
			time.Since(row.LastProbe.Time.UTC()).Round(time.Hour), healthStaleAfter)
		return health, nil
	}
	health.Healthy = true
	health.Reason = fmt.Sprintf("hit rate %.2f meets the %.2f threshold", row.HitRate, healthThresholdHitRate)
	return health, nil
}

// RecordCacheEvent inserts one probe record. pipeline_id and build_id are what
// make the impact analysis attributable: cache_events is grouped by pipeline_id
// in AnalyzePerformanceImpact, so an event recorded without one cannot be
// credited to any pipeline.
func (r *Repository) RecordCacheEvent(ctx context.Context, tenantID, cacheID, eventType string, pipelineID, buildID *string, latencySavedMs *float64) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO cache_events (tenant_id, cache_id, pipeline_id, build_id, event_type, latency_saved_ms, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
		tenantID, cacheID, pipelineID, buildID, eventType, latencySavedMs)
	return err
}

// AnalyzePerformanceImpact measures the cache's effect on one pipeline: total
// time saved across hit events and how many of the pipeline's builds actually
// hit the cache. The old version returned an empty struct with only the
// pipeline id set, which rendered as zeros with no way to tell that from a
// pipeline that genuinely saved nothing.
func (r *Repository) AnalyzePerformanceImpact(ctx context.Context, tenantID, pipelineID string) (*models.CachePerformanceImpact, error) {
	var row struct {
		TimeSavedMs     float64 `db:"time_saved_ms"`
		BuildsWithCache int     `db:"builds_with_cache"`
		TotalBuilds     int     `db:"total_builds"`
	}
	err := r.db.QueryRowContext(ctx,
		`SELECT COALESCE(SUM(latency_saved_ms) FILTER (WHERE event_type = 'hit'), 0) AS time_saved_ms,
			COUNT(DISTINCT build_id) FILTER (WHERE event_type = 'hit') AS builds_with_cache,
			COUNT(DISTINCT build_id) AS total_builds
		 FROM cache_events WHERE tenant_id = $1 AND pipeline_id = $2`, tenantID, pipelineID).
		Scan(&row.TimeSavedMs, &row.BuildsWithCache, &row.TotalBuilds)
	if err != nil {
		return nil, fmt.Errorf("analyze performance impact: %w", err)
	}
	return &models.CachePerformanceImpact{
		PipelineID:      pipelineID,
		TimeSavedMs:     row.TimeSavedMs,
		BuildsWithCache: row.BuildsWithCache,
		TotalBuilds:     row.TotalBuilds,
	}, nil
}
