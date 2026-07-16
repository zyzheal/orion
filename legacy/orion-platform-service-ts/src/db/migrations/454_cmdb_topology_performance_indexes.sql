-- Migration: 454_cmdb_topology_performance_indexes.sql
-- Purpose: Add remaining performance indexes for CMDB topology queries (Task 4.17)
--
-- Complements migrations 410 and 438 by adding:
--   1. GIN index on cmdb_ci.attributes JSONB column for attribute key/value lookups
--   2. Composite index on ci_type_attributes(ci_type_id, name) for attribute schema queries

-- ============================================================
-- cmdb_ci: GIN index for JSONB attributes column
-- ============================================================
-- Supports topology queries that filter CIs by attribute key/value:
--   WHERE attributes @> '{"env": "production"}'
--   WHERE attributes ? 'monitoring_enabled'
-- Used by: CmdbRepository listCIs with attribute filters, topology attribute lookups
CREATE INDEX IF NOT EXISTS idx_cmdb_ci_attributes_gin
    ON cmdb_ci USING GIN (attributes jsonb_path_ops);

-- ============================================================
-- ci_type_attributes: Composite index for listByType + name lookups
-- ============================================================
-- Supports: WHERE ci_type_id = $1 AND tenant_id = $2 AND deleted_at IS NULL ORDER BY sort_order
-- Used by: CIAttributeRepository.listByType, CIAttributeRepository.getAttributeByName
CREATE INDEX IF NOT EXISTS idx_ci_type_attributes_type_name
    ON ci_type_attributes(ci_type_id, name)
    WHERE deleted_at IS NULL;
