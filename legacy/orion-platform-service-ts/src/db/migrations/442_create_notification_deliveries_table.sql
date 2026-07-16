-- ============================================================
-- Migration 442: Notification Delivery Tracking
-- ============================================================
-- Purpose:
--   Track individual channel delivery attempts with retry state,
--   fallback chain, and error details for multi-channel notifications.
-- ============================================================

-- -------------------- notification_deliveries --------------------
CREATE TABLE IF NOT EXISTS notification_deliveries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  notification_id  UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  channel          VARCHAR(50) NOT NULL,
  recipient        VARCHAR(500) NOT NULL,
  subject          VARCHAR(500),
  body             TEXT,
  status           VARCHAR(20) NOT NULL DEFAULT 'pending',
  attempt_number   INTEGER NOT NULL DEFAULT 1,
  max_attempts     INTEGER NOT NULL DEFAULT 3,
  error_message    TEXT,
  response_body    TEXT,
  response_status  INTEGER,
  sent_at          TIMESTAMPTZ,
  next_retry_at    TIMESTAMPTZ,
  fallback_channel VARCHAR(50),
  metadata         JSONB DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_tenant
  ON notification_deliveries (tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_notification
  ON notification_deliveries (notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_status
  ON notification_deliveries (status);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_channel
  ON notification_deliveries (channel);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_next_retry
  ON notification_deliveries (next_retry_at) WHERE status = 'pending';

ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_notification_deliveries ON notification_deliveries;
CREATE POLICY tenant_isolation_notification_deliveries ON notification_deliveries
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

-- Rollback:
-- DROP TABLE IF EXISTS notification_deliveries;
