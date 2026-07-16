-- ============================================================
-- Migration 425: Scheduled Notifications
-- ============================================================
-- Purpose:
--   Add scheduled_notifications table for delayed/periodic
--   notification delivery.
-- ============================================================

-- -------------------- scheduled_notifications --------------------
CREATE TABLE IF NOT EXISTS scheduled_notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  template_id   UUID,
  type          VARCHAR(100) NOT NULL,
  title         VARCHAR(500) NOT NULL,
  message       TEXT NOT NULL,
  channel       VARCHAR(50) NOT NULL DEFAULT 'in-app',
  scheduled_at  TIMESTAMPTZ NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending',
  sent_at       TIMESTAMPTZ,
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_tenant
  ON scheduled_notifications (tenant_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_user
  ON scheduled_notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_status
  ON scheduled_notifications (status);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_scheduled_at
  ON scheduled_notifications (scheduled_at);

ALTER TABLE scheduled_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_notifications FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_scheduled_notifications ON scheduled_notifications;
CREATE POLICY tenant_isolation_scheduled_notifications ON scheduled_notifications
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_tenant_rls
  ON scheduled_notifications (tenant_id);
