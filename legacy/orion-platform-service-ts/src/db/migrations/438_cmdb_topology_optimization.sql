-- Migration: 438_cmdb_topology_optimization.sql
-- Purpose: CMDB topology performance optimization
-- Task: 4.17 CMDB 拓扑性能优化
--
-- Optimizations:
--   1. Add materialized path column to cmdb_ci_relation for faster tree traversal
--   2. Create covering indexes for common topology queries
--   3. Enable recursive CTE queries for ancestor/descendant lookups

-- ============================================================
-- Materialized path column for cmdb_ci_relation
-- ============================================================
-- path stores the ancestry chain as a text array-like string
-- Format: '{rootCiId}.{intermediateCiId}.{leafCiId}'
-- Enables fast "all descendants" queries via path prefix matching
ALTER TABLE cmdb_ci_relation ADD COLUMN IF NOT EXISTS path TEXT;

-- GIN index for fast path prefix matching (ancestor/descendant queries)
CREATE INDEX IF NOT EXISTS idx_cmdb_ci_relation_path
    ON cmdb_ci_relation USING GIN (path gin_trgm_ops);

-- ============================================================
-- Covering index for tenant + target CI queries
-- ============================================================
-- Supports: WHERE tenant_id = $1 AND target_ci_id = $2 AND deleted_at IS NULL
-- Used by findAffectedCIs (what depends on a given CI)
CREATE INDEX IF NOT EXISTS idx_cmdb_ci_relation_tenant_target
    ON cmdb_ci_relation(tenant_id, target_ci_id)
    WHERE deleted_at IS NULL;

-- ============================================================
-- Covering index for tenant + source CI queries
-- ============================================================
-- Supports: WHERE tenant_id = $1 AND from_ci_id = $2 AND deleted_at IS NULL
-- Used by loadTopology (what a CI depends on)
CREATE INDEX IF NOT EXISTS idx_cmdb_ci_relation_tenant_source
    ON cmdb_ci_relation(tenant_id, from_ci_id)
    WHERE deleted_at IS NULL;

-- ============================================================
-- Composite index for path-based recursive CTE performance
-- ============================================================
-- Supports recursive CTE: WHERE tenant_id = $1 AND path LIKE $2||'.%'
CREATE INDEX IF NOT EXISTS idx_cmdb_ci_relation_tenant_path
    ON cmdb_ci_relation(tenant_id, path text_pattern_ops)
    WHERE deleted_at IS NULL AND path IS NOT NULL;
