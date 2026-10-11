-- Migration 705 down: 移除 alert_severity + source CHECK 约束

BEGIN;

DROP INDEX IF EXISTS idx_tickets_tenant_alert_severity;
DROP INDEX IF EXISTS idx_tickets_alert_severity;

ALTER TABLE tickets DROP CONSTRAINT IF EXISTS chk_tickets_source_enum;

ALTER TABLE tickets DROP COLUMN IF EXISTS alert_severity;

COMMIT;
