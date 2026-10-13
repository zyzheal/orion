-- Migration 784: Add tenant_id to alert_shift_assignments (C-2 fix)
-- The original migration 745 created this table without tenant_id,
-- causing TenantAwareRepository.Select to fail when it injects
-- "WHERE tenant_id = $1" into queries.

ALTER TABLE alert_shift_assignments
    ADD COLUMN IF NOT EXISTS tenant_id TEXT;

-- Backfill tenant_id from parent shift
UPDATE alert_shift_assignments a
SET tenant_id = s.tenant_id
FROM alert_shifts s
WHERE a.shift_id = s.id AND a.tenant_id IS NULL;

ALTER TABLE alert_shift_assignments
    ALTER COLUMN tenant_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_alert_shift_assignments_tenant
    ON alert_shift_assignments(tenant_id);
