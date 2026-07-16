-- Migration 344: Cache Monitor Metrics Persistence
-- Creates build_cache_metrics table for cache monitoring data
-- Adds cache_enabled column to pipeline_runs for performance impact analysis

-- Cache metrics table (per-cache hit/miss/size/eviction tracking)
CREATE TABLE IF NOT EXISTS build_cache_metrics (
  cache_id          VARCHAR(255) PRIMARY KEY,
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  total_hits        BIGINT NOT NULL DEFAULT 0,
  total_misses      BIGINT NOT NULL DEFAULT 0,
  hit_rate          DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_size_bytes  BIGINT NOT NULL DEFAULT 0,
  max_size_bytes    BIGINT NOT NULL DEFAULT 10737418240,  -- 10GB default
  eviction_count    BIGINT NOT NULL DEFAULT 0,
  avg_latency_saved_ms DOUBLE PRECISION NOT NULL DEFAULT 0,
  last_updated      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_build_cache_metrics_tenant ON build_cache_metrics(tenant_id);
CREATE INDEX idx_build_cache_metrics_hit_rate ON build_cache_metrics(hit_rate);
CREATE INDEX idx_build_cache_metrics_last_updated ON build_cache_metrics(last_updated DESC);

COMMENT ON TABLE build_cache_metrics IS 'Build cache hit/miss/size metrics for monitoring';
COMMENT ON COLUMN build_cache_metrics.cache_id IS 'Cache identifier (typically config_id or pipeline_id)';
COMMENT ON COLUMN build_cache_metrics.hit_rate IS 'Cache hit rate (0.0 to 1.0)';
COMMENT ON COLUMN build_cache_metrics.avg_latency_saved_ms IS 'Average latency saved per cache hit in milliseconds';

-- Add cache_enabled tracking to pipeline_runs (nullable for backward compat)
ALTER TABLE pipeline_runs ADD COLUMN IF NOT EXISTS cache_enabled BOOLEAN;

COMMENT ON COLUMN pipeline_runs.cache_enabled IS 'Whether build cache was enabled for this run';

-- RLS for build_cache_metrics
ALTER TABLE build_cache_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE build_cache_metrics FORCE ROW LEVEL SECURITY;

CREATE POLICY build_cache_metrics_tenant_isolation ON build_cache_metrics
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Rollback:
-- DROP TABLE IF EXISTS build_cache_metrics;
-- ALTER TABLE pipeline_runs DROP COLUMN IF EXISTS cache_enabled;
