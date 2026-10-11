-- Migration 706 down: Drop cmdb_ci_types table

BEGIN;

-- 依赖顺序: 先删索引, 再删表 (与 up 相反)
DROP INDEX IF EXISTS idx_cmdb_ci_types_attributes_gin;
DROP INDEX IF EXISTS idx_cmdb_ci_types_tenant;

DROP TABLE IF EXISTS cmdb_ci_types;

COMMIT;
