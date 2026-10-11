-- Migration 707 down: Remove type_id column from cmdb_cis

BEGIN;

DROP INDEX IF EXISTS idx_cmdb_cis_tenant_type_id;
DROP INDEX IF EXISTS idx_cmdb_cis_type_id;

ALTER TABLE cmdb_cis DROP COLUMN IF EXISTS type_id;

COMMIT;
