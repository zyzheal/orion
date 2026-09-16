-- 652_create_task_timeout_missing_tables.sql
-- task-timeout 模块: task_timeout_events / task_timeout_checker_status 2 张表无 CREATE TABLE。
-- 回滚见 652_create_task_timeout_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS task_timeout_events (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL,
    task_id      TEXT NOT NULL,
    instance_id  TEXT NOT NULL DEFAULT '',
    action       TEXT NOT NULL DEFAULT '',
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_task_timeout_events_tenant ON task_timeout_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_task_timeout_events_task ON task_timeout_events(task_id);

CREATE TABLE IF NOT EXISTS task_timeout_checker_status (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    last_check_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_checked INTEGER NOT NULL DEFAULT 0
);
