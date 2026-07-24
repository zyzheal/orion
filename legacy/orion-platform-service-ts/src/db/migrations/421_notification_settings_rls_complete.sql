-- ============================================================
-- Migration 421: Notification Settings RLS & Completeness
-- ============================================================
-- Purpose:
--   Ensure notification_settings table has Row Level Security,
--   updated_at trigger, and proper indexes for tenant isolation.
--   This complements migration 048 which created the base table
--   without RLS support.
-- ============================================================

-- -------------------- RLS for notification_settings --------------------
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_notification_settings ON notification_settings;
CREATE POLICY tenant_isolation_notification_settings ON notification_settings
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

-- -------------------- updated_at trigger --------------------
CREATE OR REPLACE FUNCTION update_notification_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notification_settings_updated_at ON notification_settings;
CREATE TRIGGER trg_notification_settings_updated_at
  BEFORE UPDATE ON notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_settings_updated_at();

-- -------------------- Indexes --------------------
CREATE INDEX IF NOT EXISTS idx_notification_settings_tenant_rls
  ON notification_settings (tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_settings_user_tenant
  ON notification_settings (user_id, tenant_id);
