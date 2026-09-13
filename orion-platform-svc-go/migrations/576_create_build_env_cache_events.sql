-- Build-env cache telemetry
--
-- cache_events is the only store that can back the four cache-monitor read
-- endpoints and the two aggregate fields of the dashboard:
--     GET /build-env/cache-monitor/metrics/:cacheId
--     GET /build-env/cache-monitor/health/:cacheId
--     GET /build-env/cache-monitor/impact/:pipelineId
--     GET /build-env/cache-monitor/dashboard        (cache_hit_rate, avg_latency_ms)
-- and it is the write target of
--     POST /build-env/cache-monitor/event
--
-- Nothing in migrations/ created cache_events. The repository INSERTed into it
-- anyway, so every POST /cache-monitor/event failed at the driver, and the
-- three read endpoints answered with hard-coded constants instead (SELECT 0 AS
-- hits, SELECT 0.0 AS hit_rate, Healthy: true unconditionally). AssessCacheHealth
-- returned Healthy=true for a cache with zero traffic; GetCacheMetrics ignored
-- both of its parameters.
--
-- The column shape follows the sibling tables in 016_create_build_env_tables.sql:
-- tenant_id is UUID to match builds / build_images / build_cache_configs,
-- pipeline_id and build_id are VARCHAR(255) to match builds.pipeline_id and
-- build_logs.build_id. cache_id is VARCHAR rather than UUID so a lookup by an
-- id the caller invented returns an empty aggregate instead of a driver error.
--
-- event_type is restricted to the three values the request model documents and
-- the aggregates below understand. An unknown type would be silently ignored by
-- every COUNT(*) FILTER and would poison nothing, which is worse than a loud
-- failure at the table.

CREATE TABLE IF NOT EXISTS cache_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    cache_id VARCHAR(255) NOT NULL,
    pipeline_id VARCHAR(255),
    build_id VARCHAR(255),
    event_type VARCHAR(50) NOT NULL,
    latency_saved_ms DOUBLE PRECISION,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_cache_events_type CHECK (event_type IN ('hit', 'miss', 'evict'))
);

CREATE INDEX IF NOT EXISTS idx_cache_events_tenant ON cache_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cache_events_tenant_cache ON cache_events(tenant_id, cache_id);
CREATE INDEX IF NOT EXISTS idx_cache_events_tenant_pipeline ON cache_events(tenant_id, pipeline_id);
CREATE INDEX IF NOT EXISTS idx_cache_events_created_at ON cache_events(created_at DESC);
