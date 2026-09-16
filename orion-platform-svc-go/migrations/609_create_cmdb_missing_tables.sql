-- 609_create_cmdb_missing_tables.sql
-- cmdb 模块 3 张表无 CREATE TABLE: cmdb_cis / cmdb_ci_relations / cmdb_ci_versions。
-- cmdb_cis 主键用 id (UUID), ci_id 是外部稳定标识 (TEXT)。
-- 回滚见 609_create_cmdb_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS cmdb_cis (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ci_id        TEXT NOT NULL,
    name         TEXT NOT NULL DEFAULT '',
    ci_type      TEXT NOT NULL DEFAULT '',
    status       TEXT NOT NULL DEFAULT 'active',
    description  TEXT NOT NULL DEFAULT '',
    tenant_id    UUID NOT NULL,
    created_by   TEXT NOT NULL DEFAULT '',
    environment  TEXT NOT NULL DEFAULT '',
    tags         TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cmdb_cis_tenant ON cmdb_cis(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cmdb_cis_ci_id ON cmdb_cis(ci_id);

CREATE TABLE IF NOT EXISTS cmdb_ci_relations (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_ci_id    TEXT NOT NULL,
    to_ci_id      TEXT NOT NULL,
    relation_type TEXT NOT NULL DEFAULT '',
    description   TEXT NOT NULL DEFAULT '',
    tenant_id     UUID NOT NULL,
    created_by    TEXT NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cmdb_ci_relations_tenant ON cmdb_ci_relations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cmdb_ci_relations_from ON cmdb_ci_relations(from_ci_id);
CREATE INDEX IF NOT EXISTS idx_cmdb_ci_relations_to ON cmdb_ci_relations(to_ci_id);

CREATE TABLE IF NOT EXISTS cmdb_ci_versions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ci_id        TEXT NOT NULL,
    version      TEXT NOT NULL DEFAULT '',
    snapshot     JSONB DEFAULT '{}',
    tenant_id    UUID NOT NULL,
    created_by   TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cmdb_ci_versions_tenant ON cmdb_ci_versions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cmdb_ci_versions_ci ON cmdb_ci_versions(ci_id);
