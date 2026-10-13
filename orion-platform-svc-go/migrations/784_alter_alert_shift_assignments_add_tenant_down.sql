ALTER TABLE alert_shift_assignments DROP COLUMN IF EXISTS tenant_id;
DROP INDEX IF EXISTS idx_alert_shift_assignments_tenant;
