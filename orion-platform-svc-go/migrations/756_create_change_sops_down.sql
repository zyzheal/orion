-- Migration 756 down: Drop change_sops

BEGIN;

DROP INDEX IF EXISTS idx_change_sops_active;
DROP INDEX IF EXISTS idx_change_sops_template;
DROP INDEX IF EXISTS idx_change_sops_tenant;

DROP TABLE IF EXISTS change_sops;

COMMIT;
