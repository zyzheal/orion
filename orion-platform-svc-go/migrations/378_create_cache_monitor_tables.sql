-- Cache monitor module tables — cache metrics + config persistence
-- Migration 378

CREATE TABLE IF NOT EXISTS cache_metrics (
    id VARCHAR(36) PRIMARY KEY,
    cache_name VARCHAR(128) NOT NULL,
    cache_type VARCHAR(32) NOT NULL,
    connections_active BIGINT DEFAULT 0,
    connections_total BIGINT DEFAULT 0,
    memory_used BIGINT DEFAULT 0,
    memory_total BIGINT DEFAULT 0,
    hit_count BIGINT DEFAULT 0,
    miss_count BIGINT DEFAULT 0,
    eviction_count BIGINT DEFAULT 0,
    key_count BIGINT DEFAULT 0,
    expiration_count BIGINT DEFAULT 0,
    avg_latency_ms DOUBLE PRECISION DEFAULT 0,
    p95_latency_ms DOUBLE PRECISION DEFAULT 0,
    status VARCHAR(32) DEFAULT 'unknown',
    last_collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cache_metrics_name ON cache_metrics(cache_name);
CREATE INDEX IF NOT EXISTS idx_cache_metrics_collected ON cache_metrics(last_collected_at DESC);

CREATE TABLE IF NOT EXISTS cache_configs (
    id VARCHAR(36) PRIMARY KEY,
    cache_name VARCHAR(128) NOT NULL UNIQUE,
    cache_type VARCHAR(32) NOT NULL,
    host VARCHAR(255),
    port INTEGER DEFAULT 0,
    collection_interval_sec INTEGER DEFAULT 30,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cache_configs_name ON cache_configs(cache_name);
CREATE INDEX IF NOT EXISTS idx_cache_configs_enabled ON cache_configs(is_enabled);