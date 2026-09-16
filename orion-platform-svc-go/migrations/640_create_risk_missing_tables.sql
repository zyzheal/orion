-- 640_create_risk_missing_tables.sql
-- risk 模块: risk 表无 CREATE TABLE。
-- 回滚见 640_create_risk_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS risk (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL,
    name       TEXT NOT NULL,
    value      TEXT NOT NULL DEFAULT '',
    enabled    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_risk_tenant ON risk(tenant_id);
