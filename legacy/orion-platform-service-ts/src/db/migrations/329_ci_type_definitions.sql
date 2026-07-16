-- Migration 329: CI Type Definitions (CMDB CI 类型设计器)
-- CMDB CI 类型自定义定义

CREATE TABLE IF NOT EXISTS ci_type_definitions (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id       TEXT NOT NULL,
    type_name       TEXT NOT NULL,
    display_name    TEXT,
    description     TEXT,
    icon            TEXT,
    attributes      JSONB NOT NULL DEFAULT '[]',
    relationships   JSONB NOT NULL DEFAULT '[]',
    lifecycle       JSONB NOT NULL DEFAULT '{}',
    enabled         BOOLEAN NOT NULL DEFAULT true,
    created_by      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, type_name)
);

CREATE INDEX idx_ci_type_definitions_tenant ON ci_type_definitions(tenant_id);

ALTER TABLE ci_type_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ci_type_definitions FORCE ROW LEVEL SECURITY;
CREATE POLICY ci_type_definitions_tenant_isolation ON ci_type_definitions
    USING (tenant_id = current_setting('app.current_tenant_id', true));

-- CMDB 元数据 Schema 扩展
CREATE TABLE IF NOT EXISTS ci_metadata_schemas (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id       TEXT NOT NULL,
    ci_type         TEXT NOT NULL,
    schema          JSONB NOT NULL DEFAULT '{}',
    version         INTEGER NOT NULL DEFAULT 1,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, ci_type, version)
);

ALTER TABLE ci_metadata_schemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ci_metadata_schemas FORCE ROW LEVEL SECURITY;
CREATE POLICY ci_metadata_schemas_tenant_isolation ON ci_metadata_schemas
    USING (tenant_id = current_setting('app.current_tenant_id', true));
