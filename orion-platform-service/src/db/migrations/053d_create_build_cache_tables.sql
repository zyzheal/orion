-- Migration 053: Build Cache Config & Entries (PostgreSQL Repository pattern)
-- Replaces the Map() in-memory storage in BuildCacheService with persistent PostgreSQL tables

-- Build Cache Config table (三级缓存开关：全局/流水线/任务)
CREATE TABLE IF NOT EXISTS build_cache_configs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level            VARCHAR(20) NOT NULL,          -- 'global', 'pipeline', 'task'
  target_id        VARCHAR(255),                  -- 目标ID（流水线ID或任务ID，全局级别为空）
  status           VARCHAR(20) NOT NULL DEFAULT 'enabled',  -- 'enabled', 'disabled'
  storage_type     VARCHAR(20) NOT NULL DEFAULT 'local-volume',  -- 'local-volume', 's3', 'nfs'
  storage_path     VARCHAR(500),                  -- 存储路径
  max_total_size   VARCHAR(50),                   -- 最大总容量，如 '10Gi'
  max_age_days     INT,                           -- 缓存最大保留天数
  cleanup_policy   VARCHAR(20) NOT NULL DEFAULT 'lru',  -- 'lru', 'ttl', 'manual', 'never'
  cache_key_pattern VARCHAR(255),                 -- 缓存键模式（支持变量）
  cache_paths      JSONB NOT NULL DEFAULT '[]',   -- 缓存路径列表
  description      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ
);

-- Unique constraint: 每个级别+目标只能有一个配置
CREATE UNIQUE INDEX idx_build_cache_configs_level_target
  ON build_cache_configs(level, COALESCE(target_id, ''));

CREATE INDEX idx_build_cache_configs_level ON build_cache_configs(level);
CREATE INDEX idx_build_cache_configs_status ON build_cache_configs(status);

COMMENT ON TABLE build_cache_configs IS 'Build cache configuration, supports global/pipeline/task three-level switches';
COMMENT ON COLUMN build_cache_configs.level IS 'Cache level: global, pipeline, task';
COMMENT ON COLUMN build_cache_configs.target_id IS 'Target ID (pipeline ID or task ID, empty for global level)';
COMMENT ON COLUMN build_cache_configs.cache_paths IS 'Cache path list (JSON array)';

-- Build Cache Entries table (实际产生的缓存实例)
CREATE TABLE IF NOT EXISTS build_cache_entries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id        UUID NOT NULL REFERENCES build_cache_configs(id) ON DELETE CASCADE,
  cache_key        VARCHAR(500) NOT NULL,         -- 缓存键
  hash             VARCHAR(64) NOT NULL,           -- 依赖文件 hash
  size_bytes       BIGINT,                        -- 缓存大小（字节）
  storage_path     VARCHAR(500) NOT NULL,          -- 实际存储路径
  hit_count        INT NOT NULL DEFAULT 0,        -- 命中次数
  last_hit_at      TIMESTAMPTZ,                   -- 最后命中时间
  expires_at       TIMESTAMPTZ,                   -- 过期时间
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ
);

CREATE INDEX idx_build_cache_entries_config ON build_cache_entries(config_id);
CREATE INDEX idx_build_cache_entries_cache_key ON build_cache_entries(cache_key);
CREATE INDEX idx_build_cache_entries_hash ON build_cache_entries(hash);
CREATE INDEX idx_build_cache_entries_expires ON build_cache_entries(expires_at);

COMMENT ON TABLE build_cache_entries IS 'Build cache entries (actual cache instances)';
COMMENT ON COLUMN build_cache_entries.config_id IS 'Reference to cache config';
COMMENT ON COLUMN build_cache_entries.cache_key IS 'Cache key for lookup';
COMMENT ON COLUMN build_cache_entries.hit_count IS 'Number of cache hits';

-- Rollback:
-- DROP TABLE IF EXISTS build_cache_entries, build_cache_configs;
