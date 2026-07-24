-- Migration: 410_cmdb_topology_indexes.sql
-- Purpose: Add composite indexes for CMDB topology queries to improve performance
-- Task: 4.17 CMDB 拓扑性能优化
--
-- Analysis Summary:
--   - listCIs(): WHERE tenant_id + ci_type + status + environment (missing composite)
--   - getCIRelations(): WHERE (from_ci_id OR to_ci_id) AND tenant_id (OR inefficiency)
--   - relationExists(): WHERE from_ci_id + to_ci_id + relation_type + tenant_id (missing composite)
--   - getVersions(): WHERE ci_id + tenant_id ORDER BY version DESC (missing composite)
--   - getCurrentVersion(): WHERE ci_id + tenant_id (missing composite)
--
-- All indexes use IF NOT EXISTS for idempotency

-- ============================================================
-- cmdb_ci: Composite index for listCIs filter + sort
-- ============================================================
-- Supports: WHERE tenant_id = $1 AND ci_type = $2 AND status = $3 AND environment = $4
--           ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_cmdb_ci_tenant_type_status_env
    ON cmdb_ci(tenant_id, ci_type, status, environment, created_at DESC);

-- ============================================================
-- cmdb_ci_relation: Composite indexes for getCIRelations (OR optimization)
-- ============================================================
-- Supports: WHERE from_ci_id = $1 AND tenant_id = $2 AND deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_cmdb_ci_rel_tenant_from
    ON cmdb_ci_relation(tenant_id, from_ci_id)
    WHERE deleted_at IS NULL;

-- Supports: WHERE to_ci_id = $1 AND tenant_id = $2 AND deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_cmdb_ci_rel_tenant_to
    ON cmdb_ci_relation(tenant_id, to_ci_id)
    WHERE deleted_at IS NULL;

-- ============================================================
-- cmdb_ci_relation: Composite index for relationExists uniqueness check
-- ============================================================
-- Supports: WHERE from_ci_id = $1 AND to_ci_id = $2 AND relation_type = $3
--           AND tenant_id = $4 AND deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_cmdb_ci_rel_from_to_type_tenant
    ON cmdb_ci_relation(from_ci_id, to_ci_id, relation_type, tenant_id)
    WHERE deleted_at IS NULL;

-- ============================================================
-- cmdb_ci_version: Composite index for getVersions + getCurrentVersion
-- ============================================================
-- Supports: WHERE ci_id = $1 AND tenant_id = $2 ORDER BY version DESC
CREATE INDEX IF NOT EXISTS idx_cmdb_ci_ver_ci_tenant_version
    ON cmdb_ci_version(ci_id, tenant_id, version DESC);
