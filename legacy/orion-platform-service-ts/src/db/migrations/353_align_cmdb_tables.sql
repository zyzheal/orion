-- Migration: 353_align_cmdb_tables.sql
-- Purpose: Align CMDB table names and schemas with existing repository implementations
-- Notes:
--   - Renames cmdb_relation -> cmdb_ci_relation (matches CmdbRelationRepository)
--   - Renames cmdb_version -> cmdb_ci_version (matches CmdbVersionRepository)
--   - Adds tenant_id to cmdb_ci_relation and cmdb_ci_version for multi-tenant isolation
--   - Ensures column names match what repositories expect

-- Rename table: cmdb_relation -> cmdb_ci_relation
ALTER TABLE cmdb_relation RENAME TO cmdb_ci_relation;

-- Rename table: cmdb_version -> cmdb_ci_version
ALTER TABLE cmdb_version RENAME TO cmdb_ci_version;

-- Add tenant_id column to cmdb_ci_relation if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cmdb_ci_relation' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE cmdb_ci_relation ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
  END IF;
END
$$;

-- Add tenant_id column to cmdb_ci_version if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cmdb_ci_version' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE cmdb_ci_version ADD COLUMN tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
  END IF;
END
$$;

-- Drop old indexes before recreating with new table names
DROP INDEX IF EXISTS idx_cmdb_rel_tenant;
DROP INDEX IF EXISTS idx_cmdb_rel_from;
DROP INDEX IF EXISTS idx_cmdb_rel_to;
DROP INDEX IF EXISTS idx_cmdb_rel_type;
DROP INDEX IF EXISTS idx_cmdb_rel_deleted;

CREATE INDEX IF NOT EXISTS idx_cmdb_ci_relation_tenant ON cmdb_ci_relation(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cmdb_ci_relation_from ON cmdb_ci_relation(from_ci_id);
CREATE INDEX IF NOT EXISTS idx_cmdb_ci_relation_to ON cmdb_ci_relation(to_ci_id);
CREATE INDEX IF NOT EXISTS idx_cmdb_ci_relation_type ON cmdb_ci_relation(relation_type);
CREATE INDEX IF NOT EXISTS idx_cmdb_ci_relation_deleted ON cmdb_ci_relation(deleted_at) WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS idx_cmdb_ver_tenant;
DROP INDEX IF EXISTS idx_cmdb_ver_ci;
DROP INDEX IF EXISTS idx_cmdb_ver_ci_ver;

CREATE INDEX IF NOT EXISTS idx_cmdb_ci_version_tenant ON cmdb_ci_version(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cmdb_ci_version_ci ON cmdb_ci_version(ci_id);
CREATE INDEX IF NOT EXISTS idx_cmdb_ci_version_ci_ver ON cmdb_ci_version(ci_id, version DESC);
