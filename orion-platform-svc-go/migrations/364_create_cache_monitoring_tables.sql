-- Create cache monitoring tables for cache-monitor module
CREATE TABLE IF NOT EXISTS cache_metrics (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(256) NOT NULL,
    type VARCHAR(64),
    connections_active BIGINT DEFAULT 0,
    connections_total BIGINT DEFAULT 0,
    memory_used BIGINT DEFAULT 0,
    memory_total BIGINT DEFAULT 0,
    hit_count BIGINT DEFAULT 0,
    miss_count BIGINT DEFAULT 0,
    eviction_count BIGINT DEFAULT 0,
    key_count BIGINT DEFAULT 0,
    avg_latency_ms DOUBLE PRECISION DEFAULT 0,
    p95_latency_ms DOUBLE PRECISION DEFAULT 0,
    status VARCHAR(32),
    last_collected_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_cache_metrics_name ON cache_metrics(name);

CREATE TABLE IF NOT EXISTS cache_configs (
    name VARCHAR(256) PRIMARY KEY,
    type VARCHAR(64),
    host VARCHAR(256),
    port INTEGER,
    collection_interval_sec INTEGER DEFAULT 60,
    is_enabled BOOLEAN DEFAULT TRUE
);
