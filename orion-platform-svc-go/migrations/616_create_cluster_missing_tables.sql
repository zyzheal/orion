-- 616_create_cluster_missing_tables.sql
-- cluster 模块: clusters 表无 CREATE TABLE。
-- 回滚见 616_create_cluster_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS clusters (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL,
    name         TEXT NOT NULL,
    api_endpoint TEXT NOT NULL,
    ca_cert      TEXT NOT NULL DEFAULT '',
    token        TEXT NOT NULL DEFAULT '',
    version      TEXT NOT NULL DEFAULT '',
    status       TEXT NOT NULL DEFAULT 'active',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clusters_tenant ON clusters(tenant_id);
