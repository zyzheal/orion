-- 051_runner_cache_metadata.sql
-- RunnerCacheService PostgreSQL 元数据表
-- 支持乐观锁和缓存键版本化

-- 缓存元数据表
CREATE TABLE IF NOT EXISTS runner_cache_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key VARCHAR(64) NOT NULL,           -- 原始缓存键（如 "npm-node-modules-v1.0.0"）
  cache_hash VARCHAR(16) NOT NULL,          -- 缓存键的 SHA256 哈希（用于目录名）
  version INTEGER NOT NULL DEFAULT 1,       -- 乐观锁版本号
  paths TEXT[] NOT NULL,                    -- 缓存路径列表
  size_bytes BIGINT NOT NULL DEFAULT 0,     -- 缓存大小（字节）
  run_id VARCHAR(64) NOT NULL,              -- 关联的 Pipeline Run ID
  stage_id VARCHAR(64) NOT NULL,            -- 关联的 Stage ID
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,  -- 是否有效（软删除标记）

  -- 索引优化
  CONSTRAINT unique_cache_key_hash UNIQUE (cache_hash, is_active)
);

-- 查询索引
CREATE INDEX idx_cache_key ON runner_cache_metadata(cache_key) WHERE is_active = TRUE;
CREATE INDEX idx_cache_hash ON runner_cache_metadata(cache_hash) WHERE is_active = TRUE;
CREATE INDEX idx_cache_prefix ON runner_cache_metadata USING btree (cache_key varchar_pattern_ops) WHERE is_active = TRUE;
CREATE INDEX idx_cache_expires ON runner_cache_metadata(expires_at) WHERE is_active = TRUE AND expires_at < NOW();
CREATE INDEX idx_cache_run_stage ON runner_cache_metadata(run_id, stage_id);

-- 缓存使用统计表
CREATE TABLE IF NOT EXISTS runner_cache_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key_hash VARCHAR(16) NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0,     -- 命中次数
  last_hit_at TIMESTAMP WITH TIME ZONE,     -- 最后命中时间
  last_miss_at TIMESTAMP WITH TIME ZONE,    -- 最后未命中时间
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_cache_stats FOREIGN KEY (cache_key_hash)
    REFERENCES runner_cache_metadata(cache_hash) ON DELETE CASCADE
);

CREATE INDEX idx_cache_stats_hash ON runner_cache_stats(cache_key_hash);
