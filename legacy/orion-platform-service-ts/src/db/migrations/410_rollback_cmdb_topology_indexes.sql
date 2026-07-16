-- Rollback: 410_rollback_cmdb_topology_indexes.sql
-- Purpose: Drop indexes added in 410_cmdb_topology_indexes.sql
-- Task: 4.17 CMDB 拓扑性能优化

-- Drop composite indexes on cmdb_ci
DROP INDEX IF EXISTS idx_cmdb_ci_tenant_type_status_env;

-- Drop composite indexes on cmdb_ci_relation
DROP INDEX IF EXISTS idx_cmdb_ci_rel_tenant_from;
DROP INDEX IF EXISTS idx_cmdb_ci_rel_tenant_to;
DROP INDEX IF EXISTS idx_cmdb_ci_rel_from_to_type_tenant;

-- Drop composite index on cmdb_ci_version
DROP INDEX IF EXISTS idx_cmdb_ci_ver_ci_tenant_version;
