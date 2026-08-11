package repository

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/cache-monitor/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) SaveMetrics(ctx context.Context, m *models.CacheMetrics) error {
	if r.db == nil {
		return nil
	}
	id := uuid.New().String()
	now := time.Now().UTC()
	m.Name = m.Name
	m.Type = m.Type
	m.LastCollectedAt = now
	m.Status = m.Status
	if m.Status == "" {
		m.Status = "unknown"
	}

	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO cache_metrics (id, cache_name, cache_type, connections_active, connections_total,
		 memory_used, memory_total, hit_count, miss_count, eviction_count, key_count,
		 expiration_count, avg_latency_ms, p95_latency_ms, status, last_collected_at, created_at)
		 VALUES (:id, :cache_name, :cache_type, :connections_active, :connections_total,
		 :memory_used, :memory_total, :hit_count, :miss_count, :eviction_count, :key_count,
		 :expiration_count, :avg_latency_ms, :p95_latency_ms, :status, :last_collected_at, :created_at)`,
		map[string]interface{}{
			"id":                id,
			"cache_name":        m.Name,
			"cache_type":        m.Type,
			"connections_active": int64(m.ConnectionsActive),
			"connections_total":  int64(m.ConnectionsTotal),
			"memory_used":        m.MemoryUsed,
			"memory_total":       m.MemoryTotal,
			"hit_count":          m.HitCount,
			"miss_count":         m.MissCount,
			"eviction_count":     m.EvictionCount,
			"key_count":          m.KeyCount,
			"expiration_count":   m.ExpirationCount,
			"avg_latency_ms":     m.AvgLatencyMs,
			"p95_latency_ms":     m.P95LatencyMs,
			"status":             m.Status,
			"last_collected_at":  m.LastCollectedAt,
			"created_at":         now,
		})
	return err
}

func (r *Repository) GetMetrics(ctx context.Context, name string) (*models.CacheMetrics, error) {
	if r.db == nil {
		return nil, nil
	}
	var m models.CacheMetrics
	err := r.db.GetContext(ctx, &m,
		`SELECT id, cache_name, cache_type, connections_active, connections_total,
		 memory_used, memory_total, hit_count, miss_count, eviction_count, key_count,
		 expiration_count, avg_latency_ms, p95_latency_ms, status, last_collected_at
		 FROM cache_metrics WHERE cache_name=$1 ORDER BY last_collected_at DESC LIMIT 1`, name)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) ListMetrics(ctx context.Context) ([]*models.CacheMetrics, error) {
	if r.db == nil {
		return nil, nil
	}
	var items []models.CacheMetrics
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, cache_name, cache_type, connections_active, connections_total,
		 memory_used, memory_total, hit_count, miss_count, eviction_count, key_count,
		 expiration_count, avg_latency_ms, p95_latency_ms, status, last_collected_at
		 FROM cache_metrics ORDER BY cache_name, last_collected_at DESC`)
	if err != nil {
		return nil, err
	}
	result := make([]*models.CacheMetrics, 0, len(items))
	for i := range items {
		result = append(result, &items[i])
	}
	return result, nil
}

func (r *Repository) SaveConfig(ctx context.Context, cfg *models.CacheConfig) error {
	if r.db == nil {
		return nil
	}
	id := uuid.New().String()
	now := time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO cache_configs (id, cache_name, cache_type, host, port,
		 collection_interval_sec, is_enabled, created_at, updated_at)
		 VALUES (:id, :cache_name, :cache_type, :host, :port,
		 :collection_interval_sec, :is_enabled, :created_at, :updated_at)
		 ON CONFLICT (cache_name) DO UPDATE SET
		 cache_type = EXCLUDED.cache_type,
		 host = EXCLUDED.host,
		 port = EXCLUDED.port,
		 collection_interval_sec = EXCLUDED.collection_interval_sec,
		 is_enabled = EXCLUDED.is_enabled,
		 updated_at = EXCLUDED.updated_at`,
		map[string]interface{}{
			"id":                     id,
			"cache_name":             cfg.Name,
			"cache_type":             cfg.Type,
			"host":                   cfg.Host,
			"port":                   cfg.Port,
			"collection_interval_sec": cfg.CollectionInterval,
			"is_enabled":             cfg.IsEnabled,
			"created_at":             now,
			"updated_at":             now,
		})
	return err
}

func (r *Repository) GetConfig(ctx context.Context, name string) (*models.CacheConfig, error) {
	if r.db == nil {
		return nil, nil
	}
	var cfg models.CacheConfig
	err := r.db.GetContext(ctx, &cfg,
		`SELECT id, cache_name, cache_type, host, port, collection_interval_sec, is_enabled, created_at, updated_at
		 FROM cache_configs WHERE cache_name=$1`, name)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sentinel.NotFound
	}
	if err != nil {
		return nil, err
	}
	return &cfg, nil
}

func (r *Repository) ListConfigs(ctx context.Context) ([]*models.CacheConfig, error) {
	if r.db == nil {
		return nil, nil
	}
	var items []models.CacheConfig
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, cache_name, cache_type, host, port, collection_interval_sec, is_enabled, created_at, updated_at
		 FROM cache_configs ORDER BY cache_name`)
	if err != nil {
		return nil, err
	}
	result := make([]*models.CacheConfig, 0, len(items))
	for i := range items {
		result = append(result, &items[i])
	}
	return result, nil
}

func (r *Repository) DeleteConfig(ctx context.Context, name string) error {
	if r.db == nil {
		return nil
	}
	_, err := r.db.ExecContext(ctx, `DELETE FROM cache_configs WHERE cache_name=$1`, name)
	return err
}