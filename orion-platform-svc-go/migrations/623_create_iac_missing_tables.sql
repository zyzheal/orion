-- 623_create_iac_missing_tables.sql
-- iac 模块: iac_modules 表无 CREATE TABLE。
-- 回滚见 623_create_iac_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS iac_modules (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    source      TEXT NOT NULL DEFAULT '',
    version     TEXT NOT NULL DEFAULT '1',
    inputs      JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_iac_modules_tenant ON iac_modules(tenant_id);
