-- 660_create_community_advanced_missing_tables.sql
-- community-advanced 模块: community_advanced 表无 CREATE TABLE。
-- 回滚见 660_create_community_advanced_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS community_advanced (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL,
    name       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_community_advanced_tenant ON community_advanced(tenant_id);
