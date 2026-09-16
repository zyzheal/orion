-- 631_create_module_missing_tables.sql
-- module 模块: module 表无 CREATE TABLE。表名是 SQL 保留字, 用引号包裹。
-- 回滚见 631_create_module_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS "module" (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name           TEXT NOT NULL,
    display_name   TEXT NOT NULL DEFAULT '',
    description    TEXT NOT NULL DEFAULT '',
    version        TEXT NOT NULL DEFAULT '1.0.0',
    enabled        BOOLEAN NOT NULL DEFAULT TRUE,
    status         TEXT NOT NULL DEFAULT 'registered',
    dependencies   JSONB DEFAULT '[]',
    startup_order  INTEGER NOT NULL DEFAULT 0,
    core           BOOLEAN NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_module_name ON "module"(name);
