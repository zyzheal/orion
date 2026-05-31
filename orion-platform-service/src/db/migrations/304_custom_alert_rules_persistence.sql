-- Migration 304: Create table for Custom Alert Rules
-- Table: custom_alert_rules

CREATE TABLE IF NOT EXISTS custom_alert_rules (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  rule_type VARCHAR(20) NOT NULL,
  condition JSONB NOT NULL,
  severity VARCHAR(20) DEFAULT 'warning',
  enabled BOOLEAN DEFAULT true,
  notification_channels JSONB,
  evaluation_interval_sec INTEGER DEFAULT 60,
  cooldown_sec INTEGER DEFAULT 300,
  last_evaluated_at TIMESTAMP,
  last_triggered_at TIMESTAMP,
  created_by VARCHAR(64),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_alert_rules_tenant ON custom_alert_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_custom_alert_rules_enabled ON custom_alert_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_custom_alert_rules_severity ON custom_alert_rules(severity);
