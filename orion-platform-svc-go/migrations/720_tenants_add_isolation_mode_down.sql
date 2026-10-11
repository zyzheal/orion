-- Migration 720 down: Remove isolation columns from tenants

BEGIN;

DROP INDEX IF EXISTS idx_tenants_isolation_mode;

ALTER TABLE tenants DROP COLUMN IF EXISTS schema_created_at;
ALTER TABLE tenants DROP COLUMN IF EXISTS schema_name;
ALTER TABLE tenants DROP COLUMN IF EXISTS isolation_mode;

COMMIT;
