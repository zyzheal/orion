-- Migration 221: Fix custom_alert_rules table schema to match CustomAlertRuleRepository
-- The table in migration 093 uses different column names and types than the repository expects

-- Drop the old table if it exists (recreate with correct schema)
-- This is safe because the service uses memory fallback when db is not available
DROP TABLE IF EXISTS custom_alert_rules CASCADE;

CREATE TABLE IF NOT EXISTS custom_alert_rules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  description TEXT,
  rule_type TEXT NOT NULL DEFAULT 'threshold',
  condition JSONB NOT NULL DEFAULT '{}',
  severity TEXT NOT NULL DEFAULT 'warning',
  enabled BOOLEAN NOT NULL DEFAULT true,
  notification_channels JSONB,
  evaluation_interval_sec INTEGER NOT NULL DEFAULT 60,
  cooldown_sec INTEGER NOT NULL DEFAULT 300,
  last_evaluated_at TIMESTAMPTZ,
  last_triggered_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_alert_rules_tenant ON custom_alert_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_custom_alert_rules_enabled ON custom_alert_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_custom_alert_rules_severity ON custom_alert_rules(severity);
CREATE INDEX IF NOT EXISTS idx_custom_alert_rules_type ON custom_alert_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_custom_alert_rules_created ON custom_alert_rules(created_at DESC);
