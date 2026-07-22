-- ============================================================
-- Migration 411: Notification Core Tables - RLS & Indexes
-- ============================================================
-- Purpose:
--   Ensure notifications, notification_channels, and
--   notification_templates have complete indexes and
--   Row Level Security (RLS) for tenant isolation.
--
--   Uses CREATE TABLE IF NOT EXISTS for idempotency on
--   fresh databases, and ALTER TABLE ENABLE ROW LEVEL SECURITY
--   for existing deployments (idempotent DDL).
-- ============================================================

-- -------------------- notifications --------------------
CREATE TABLE IF NOT EXISTS notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  type          VARCHAR(100),
  title         VARCHAR(500),
  message       TEXT,
  channel       VARCHAR(50) NOT NULL DEFAULT 'in-app',
  status        VARCHAR(20) NOT NULL DEFAULT 'pending',
  sent_at       TIMESTAMPTZ,
  read_at       TIMESTAMPTZ,
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_tenant
  ON notifications (tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status
  ON notifications (status);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at
  ON notifications (created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_notifications ON notifications;
CREATE POLICY tenant_isolation_notifications ON notifications
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_notifications_tenant_rls
  ON notifications (tenant_id);

-- -------------------- notification_channels --------------------
CREATE TABLE IF NOT EXISTS notification_channels (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          VARCHAR(200) NOT NULL,
  type          VARCHAR(50) NOT NULL,
  config        JSONB NOT NULL,
  enabled       BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_channels_tenant
  ON notification_channels (tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_channels_type
  ON notification_channels (type);
CREATE INDEX IF NOT EXISTS idx_notification_channels_enabled
  ON notification_channels (enabled) WHERE enabled = true;

ALTER TABLE notification_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_channels FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_notification_channels ON notification_channels;
CREATE POLICY tenant_isolation_notification_channels ON notification_channels
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_notification_channels_tenant_rls
  ON notification_channels (tenant_id);

-- -------------------- notification_templates --------------------
CREATE TABLE IF NOT EXISTS notification_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          VARCHAR(200) NOT NULL,
  event_type    VARCHAR(100) NOT NULL,
  subject       VARCHAR(500),
  body_template TEXT NOT NULL,
  channel_ids   UUID[] DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_templates_tenant
  ON notification_templates (tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_templates_event_type
  ON notification_templates (event_type);

ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_notification_templates ON notification_templates;
CREATE POLICY tenant_isolation_notification_templates ON notification_templates
  USING (
    current_setting('app.current_tenant_id', true) IS NOT NULL
    AND current_setting('app.current_tenant_id', true) != ''
    AND tenant_id::text = current_setting('app.current_tenant_id')
  );

CREATE INDEX IF NOT EXISTS idx_notification_templates_tenant_rls
  ON notification_templates (tenant_id);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
-- All three tables now enforce tenant isolation via RLS.
-- Session variable app.current_tenant_id must be set before
-- queries; see RLSPolicyManager for the set_config() call.
-- ============================================================
