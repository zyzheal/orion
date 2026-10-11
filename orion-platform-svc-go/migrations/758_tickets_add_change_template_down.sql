-- Migration 758 down: Remove change_template_id/change_sop_id from tickets

BEGIN;

DROP INDEX IF EXISTS idx_tickets_tenant_change;
DROP INDEX IF EXISTS idx_tickets_change_sop;
DROP INDEX IF EXISTS idx_tickets_change_template;

ALTER TABLE tickets DROP COLUMN IF EXISTS change_sop_id;
ALTER TABLE tickets DROP COLUMN IF EXISTS change_template_id;

COMMIT;
