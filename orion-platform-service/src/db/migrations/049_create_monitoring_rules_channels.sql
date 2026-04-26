-- Migration 049: Monitoring Rules, Channels, Policies, and Notification History
-- Extends monitoring module with persistent storage for alert rules,
-- notification channels, escalation policies, and notification records.

-- Alert rules (separate from cost-related alert_rules in 031)
CREATE TABLE IF NOT EXISTS monitoring_alert_rules (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                  VARCHAR(200) NOT NULL,
  metric                VARCHAR(200) NOT NULL,
  condition             VARCHAR(20) NOT NULL,
  threshold             NUMERIC NOT NULL,
  severity              VARCHAR(20) NOT NULL DEFAULT 'warning',
  enabled               BOOLEAN NOT NULL DEFAULT true,
  suppressed            BOOLEAN NOT NULL DEFAULT false,
  cooldown_ms           INT NOT NULL DEFAULT 300000,
  tags                  JSONB,
  rate_of_change_percent NUMERIC,
  description           TEXT,
  evaluation_window_ms  INT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_monitoring_alert_rules_tenant ON monitoring_alert_rules(tenant_id);
CREATE INDEX idx_monitoring_alert_rules_metric ON monitoring_alert_rules(metric);
CREATE INDEX idx_monitoring_alert_rules_enabled ON monitoring_alert_rules(enabled);

-- Notification channels for alert delivery
CREATE TABLE IF NOT EXISTS monitoring_notification_channels (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  type            VARCHAR(20) NOT NULL,
  config          JSONB NOT NULL,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  severity_filter VARCHAR(20)[],
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_monitoring_notification_channels_tenant ON monitoring_notification_channels(tenant_id);
CREATE INDEX idx_monitoring_notification_channels_type ON monitoring_notification_channels(type);

-- Escalation policies
CREATE TABLE IF NOT EXISTS monitoring_escalation_policies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          VARCHAR(200) NOT NULL,
  steps         JSONB NOT NULL,
  repeat_count  INT NOT NULL DEFAULT 0,
  enabled       BOOLEAN NOT NULL DEFAULT true,
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_monitoring_escalation_policies_tenant ON monitoring_escalation_policies(tenant_id);

-- Notification history
CREATE TABLE IF NOT EXISTS monitoring_notification_history (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  alert_id          UUID NOT NULL,
  channel_id        VARCHAR(200) NOT NULL,
  channel_type      VARCHAR(20) NOT NULL,
  status            VARCHAR(20) NOT NULL,
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  error_message     TEXT,
  response_payload  TEXT,
  escalation_step   INT
);
CREATE INDEX idx_monitoring_notification_history_tenant ON monitoring_notification_history(tenant_id);
CREATE INDEX idx_monitoring_notification_history_alert ON monitoring_notification_history(alert_id);
CREATE INDEX idx_monitoring_notification_history_sent ON monitoring_notification_history(sent_at DESC);

-- Rollback:
-- DROP TABLE IF EXISTS monitoring_notification_history, monitoring_escalation_policies, monitoring_notification_channels, monitoring_alert_rules;
