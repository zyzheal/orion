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
-- 补齐 cache_metrics：378_create_cache_monitor_tables.sql 的定义晚于 364_create_cache_monitoring_tables.sql，按序执行时表已存在
ALTER TABLE cache_metrics ADD COLUMN IF NOT EXISTS cache_name VARCHAR(128) NOT NULL, ADD COLUMN IF NOT EXISTS cache_type VARCHAR(32) NOT NULL, ADD COLUMN IF NOT EXISTS expiration_count BIGINT DEFAULT 0;

CREATE INDEX idx_cache_metrics_name ON cache_metrics(name);

CREATE TABLE IF NOT EXISTS cache_configs (
    name VARCHAR(256) PRIMARY KEY,
    type VARCHAR(64),
    host VARCHAR(256),
    port INTEGER,
    collection_interval_sec INTEGER DEFAULT 60,
    is_enabled BOOLEAN DEFAULT TRUE
);
