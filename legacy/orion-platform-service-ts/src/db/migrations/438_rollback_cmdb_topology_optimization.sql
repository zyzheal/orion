-- Rollback: 438_rollback_cmdb_topology_optimization.sql
-- Purpose: Drop indexes and columns added in 438_cmdb_topology_optimization.sql
-- Task: 4.17 CMDB 拓扑性能优化

-- Drop indexes
DROP INDEX IF EXISTS idx_cmdb_ci_relation_path;
DROP INDEX IF EXISTS idx_cmdb_ci_relation_tenant_target;
DROP INDEX IF EXISTS idx_cmdb_ci_relation_tenant_source;
DROP INDEX IF EXISTS idx_cmdb_ci_relation_tenant_path;

-- Drop materialized path column
ALTER TABLE cmdb_ci_relation DROP COLUMN IF EXISTS path;
