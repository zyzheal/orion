-- Migration 005: Add deleted_at column for soft delete support
-- Phase 5.5: 软删除统一方案
-- 修复: 代码中已使用 deleted_at 但迁移文件缺失的 GAP

-- Deployment tables
ALTER TABLE deployments ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Deploy events
ALTER TABLE deploy_events ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Deploy windows
ALTER TABLE deploy_windows ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Environments
ALTER TABLE environments ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Deploy logs
ALTER TABLE deploy_logs ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Strategy configs
ALTER TABLE strategy_configs ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Create index on deleted_at
CREATE INDEX IF NOT EXISTS idx_deployments_deleted_at ON deployments(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_deploy_events_deleted_at ON deploy_events(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_deploy_windows_deleted_at ON deploy_windows(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_environments_deleted_at ON environments(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_strategy_configs_deleted_at ON strategy_configs(deleted_at) WHERE deleted_at IS NULL;
