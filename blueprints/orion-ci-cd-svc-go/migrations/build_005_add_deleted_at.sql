-- Migration 005: Add deleted_at column for soft delete support
-- Phase 5.5: 软删除统一方案
-- 修复: 代码中已使用 deleted_at 但迁移文件缺失的 GAP

-- Build tables
ALTER TABLE builds ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Build artifacts
ALTER TABLE build_artifacts ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Build cache configs
ALTER TABLE build_cache_configs ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Builder images
ALTER TABLE builder_images ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Create index on deleted_at
CREATE INDEX IF NOT EXISTS idx_builds_deleted_at ON builds(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_build_artifacts_deleted_at ON build_artifacts(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_builder_images_deleted_at ON builder_images(deleted_at) WHERE deleted_at IS NULL;
