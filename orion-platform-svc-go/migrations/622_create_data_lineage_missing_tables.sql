-- 622_create_data_lineage_missing_tables.sql
-- data-lineage 模块: data_lineage 表无 CREATE TABLE。
-- 回滚见 622_create_data_lineage_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS data_lineage (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'active',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_data_lineage_tenant ON data_lineage(tenant_id);
