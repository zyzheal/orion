-- 651_create_subapp_missing_tables.sql
-- subapp 模块: subapp_config_history 表无 CREATE TABLE。
-- 回滚见 651_create_subapp_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS subapp_config_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subapp_key      TEXT NOT NULL,
    action          TEXT NOT NULL DEFAULT '',
    old_value       JSONB DEFAULT '{}',
    new_value       JSONB DEFAULT '{}',
    changed_by      TEXT NOT NULL DEFAULT '',
    change_summary  TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subapp_config_history_subapp ON subapp_config_history(subapp_key);
