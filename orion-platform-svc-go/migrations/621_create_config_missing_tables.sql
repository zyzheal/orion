-- 621_create_config_missing_tables.sql
-- config 模块: gitops_sync_status 表无 CREATE TABLE。
-- 回滚见 621_create_config_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS gitops_sync_status (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id  UUID NOT NULL,
    status     TEXT NOT NULL DEFAULT 'pending',
    error      TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gitops_sync_status_config ON gitops_sync_status(config_id);
