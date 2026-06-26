-- Migration 345: CI Type Designer
-- Tables: ci_type_definitions, ci_type_versions
-- Supports visual CI type designer with version management

-- ============================================================
-- CI Type Definitions (designer data for CI types)
-- ============================================================
CREATE TABLE IF NOT EXISTS ci_type_definitions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(64) NOT NULL,
  ci_type_id      UUID NOT NULL REFERENCES ci_metadata_schema(id) ON DELETE CASCADE,
  designer_data   JSONB,
  attributes      JSONB NOT NULL DEFAULT '[]',
  relations       JSONB NOT NULL DEFAULT '[]',
  version         INTEGER NOT NULL DEFAULT 1,
  change_log      JSONB NOT NULL DEFAULT '[]',
  status          VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_by      VARCHAR(128),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  UNIQUE(tenant_id, ci_type_id)
);

CREATE INDEX IF NOT EXISTS idx_ci_type_definitions_tenant ON ci_type_definitions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ci_type_definitions_ci_type ON ci_type_definitions(ci_type_id);
CREATE INDEX IF NOT EXISTS idx_ci_type_definitions_deleted ON ci_type_definitions(deleted_at) WHERE deleted_at IS NOT NULL;

ALTER TABLE ci_type_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ci_type_definitions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ci_type_definitions ON ci_type_definitions
  USING (current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id'));

-- ============================================================
-- CI Type Versions (version history for CI type definitions)
-- ============================================================
CREATE TABLE IF NOT EXISTS ci_type_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(64) NOT NULL,
  ci_type_id      UUID NOT NULL REFERENCES ci_metadata_schema(id) ON DELETE CASCADE,
  version         INTEGER NOT NULL,
  designer_data   JSONB,
  attributes      JSONB,
  relations       JSONB,
  change_summary  TEXT,
  created_by      VARCHAR(128),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(ci_type_id, version)
);

CREATE INDEX IF NOT EXISTS idx_ci_type_versions_tenant ON ci_type_versions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ci_type_versions_ci_type ON ci_type_versions(ci_type_id);

ALTER TABLE ci_type_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ci_type_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ci_type_versions ON ci_type_versions
  USING (current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id'));
