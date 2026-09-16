-- 639_create_queue_missing_tables.sql
-- queue 模块: queue 表无 CREATE TABLE。
-- 回滚见 639_create_queue_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS queue (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL,
    name       TEXT NOT NULL,
    value      TEXT NOT NULL DEFAULT '',
    enabled    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_queue_tenant ON queue(tenant_id);
