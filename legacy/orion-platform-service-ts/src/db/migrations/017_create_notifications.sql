-- Migration 017: Notification Templates & Records
-- Notification system

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
CREATE INDEX idx_notification_channels_tenant ON notification_channels(tenant_id);

-- Notification templates
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
CREATE INDEX idx_notification_templates_tenant ON notification_templates(tenant_id);

-- Notification records
CREATE TABLE IF NOT EXISTS notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  template_id   UUID REFERENCES notification_templates(id) ON DELETE SET NULL,
  channel       VARCHAR(50) NOT NULL,
  subject       VARCHAR(500),
  body          TEXT,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending',
  sent_at       TIMESTAMPTZ,
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_tenant ON notifications(tenant_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_status ON notifications(status);

-- Rollback:
-- DROP TABLE IF EXISTS notifications, notification_templates, notification_channels;
