-- 627_create_file_handler_missing_tables.sql
-- file-handler 模块: file_records / storage_backends 2 张表无 CREATE TABLE。
-- 回滚见 627_create_file_handler_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS file_records (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    name          TEXT NOT NULL,
    original_name TEXT NOT NULL DEFAULT '',
    type          TEXT NOT NULL DEFAULT '',
    extension     TEXT NOT NULL DEFAULT '',
    size          BIGINT NOT NULL DEFAULT 0,
    storage_type  TEXT NOT NULL DEFAULT '',
    storage_path  TEXT NOT NULL DEFAULT '',
    bucket        TEXT NOT NULL DEFAULT '',
    category      TEXT NOT NULL DEFAULT '',
    owner         TEXT NOT NULL DEFAULT '',
    visibility    TEXT NOT NULL DEFAULT 'private',
    tags          TEXT NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_file_records_tenant ON file_records(tenant_id);

CREATE TABLE IF NOT EXISTS storage_backends (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL,
    name       TEXT NOT NULL,
    type       TEXT NOT NULL DEFAULT '',
    config     JSONB DEFAULT '{}',
    enabled    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_storage_backends_tenant ON storage_backends(tenant_id);
