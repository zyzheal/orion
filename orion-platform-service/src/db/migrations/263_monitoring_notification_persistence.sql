-- Migration 263: Monitoring Notification Tables (consolidation)
-- Ensures tables from migration 049 exist with proper indexes for
-- AlertNotificationService PostgreSQL Repository pattern.

-- Notification channels for alert delivery
CREATE TABLE IF NOT EXISTS monitoring_notification_channels (
  id              VARCHAR(64) PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000' DEFAULT '00000000-0000-0000-0000-000000000000',
  name            VARCHAR(200) NOT NULL,
  type            VARCHAR(20) NOT NULL,
  config          JSONB NOT NULL,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  severity_filter VARCHAR(20)[],
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monitoring_notification_channels_tenant ON monitoring_notification_channels(tenant_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_notification_channels_type ON monitoring_notification_channels(type);

-- Escalation policies
CREATE TABLE IF NOT EXISTS monitoring_escalation_policies (
  id            VARCHAR(64) PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000' DEFAULT '00000000-0000-0000-0000-000000000000',
  name          VARCHAR(200) NOT NULL,
  steps         JSONB NOT NULL,
  repeat_count  INT NOT NULL DEFAULT 0,
  enabled       BOOLEAN NOT NULL DEFAULT true,
  description   TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monitoring_escalation_policies_tenant ON monitoring_escalation_policies(tenant_id);

-- Notification history
CREATE TABLE IF NOT EXISTS monitoring_notification_history (
  id                VARCHAR(64) PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000' DEFAULT '00000000-0000-0000-0000-000000000000',
  alert_id          VARCHAR(64) NOT NULL,
  channel_id        VARCHAR(200) NOT NULL,
  channel_type      VARCHAR(20) NOT NULL,
  status            VARCHAR(20) NOT NULL,
  sent_at           TIMESTAMP NOT NULL DEFAULT NOW(),
  error_message     TEXT,
  response_payload  TEXT,
  escalation_step   INT,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monitoring_notification_history_tenant ON monitoring_notification_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_notification_history_alert ON monitoring_notification_history(alert_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_notification_history_sent ON monitoring_notification_history(sent_at DESC);
