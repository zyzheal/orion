-- Migration 255: Method-Level Cache Management Tables
-- Tables for method-level cache configuration (CacheConfig) and
-- per-key cache statistics (CacheStats). Supports LRU/LFU/FIFO eviction,
-- multiple backends (memory/redis), and serializers (json/gob/msgpack).
--
-- Tables:
--   cache_configs — Cache configuration definitions
--   cache_stats   — Per-key cache hit/miss/eviction statistics
--
-- Rollback: 255_create_cache_mgmt_tables_down.sql

CREATE TABLE IF NOT EXISTS cache_configs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   VARCHAR(64) NOT NULL,
  name        VARCHAR(200) NOT NULL,
  ttl         INTEGER NOT NULL DEFAULT 300,       -- Time to live in seconds
  max_size    INTEGER NOT NULL DEFAULT 100,       -- Max entries
  eviction    VARCHAR(20) NOT NULL DEFAULT 'LRU', -- LRU, LFU, FIFO
  serializer  VARCHAR(20) NOT NULL DEFAULT 'json',-- json, gob, msgpack
  backend     VARCHAR(20) NOT NULL DEFAULT 'memory',-- memory, redis
  enabled     BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cache_configs_tenant ON cache_configs(tenant_id);
CREATE INDEX idx_cache_configs_enabled ON cache_configs(enabled);
CREATE INDEX idx_cache_configs_name ON cache_configs(name);

CREATE TABLE IF NOT EXISTS cache_stats (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id   UUID NOT NULL REFERENCES cache_configs(id) ON DELETE CASCADE,
  key         VARCHAR(512) NOT NULL,
  hits        BIGINT NOT NULL DEFAULT 0,
  misses      BIGINT NOT NULL DEFAULT 0,
  evictions   BIGINT NOT NULL DEFAULT 0,
  avg_ttl     BIGINT NOT NULL DEFAULT 0,          -- Average TTL in milliseconds
  last_access TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (config_id, key)
);
CREATE INDEX idx_cache_stats_config ON cache_stats(config_id);
CREATE INDEX idx_cache_stats_last_access ON cache_stats(last_access);
