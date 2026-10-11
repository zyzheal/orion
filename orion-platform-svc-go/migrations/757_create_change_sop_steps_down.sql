-- Migration 757 down: Drop change_sop_steps

BEGIN;

DROP INDEX IF EXISTS idx_change_sop_steps_sort;
DROP INDEX IF EXISTS idx_change_sop_steps_tenant_code;
DROP INDEX IF EXISTS idx_change_sop_steps_sop;

DROP TABLE IF EXISTS change_sop_steps;

COMMIT;
