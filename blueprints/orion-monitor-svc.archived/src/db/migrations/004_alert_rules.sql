CREATE TABLE IF NOT EXISTS alert_rules (
  id            VARCHAR(255) PRIMARY KEY,
  tenant_id     UUID NOT NULL,
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  metric        VARCHAR(255) NOT NULL,
  condition     VARCHAR(20) NOT NULL,
  threshold     DECIMAL(10,4) NOT NULL,
  threshold_max DECIMAL(10,4),
  duration      INTEGER NOT NULL DEFAULT 60,
  severity      VARCHAR(20) NOT NULL DEFAULT 'warning',
  enabled       BOOLEAN NOT NULL DEFAULT true,
  labels        JSONB NOT NULL DEFAULT '{}',
  annotations   JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_tenant ON alert_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_alert_rules_metric ON alert_rules(metric);
CREATE INDEX IF NOT EXISTS idx_alert_rules_severity ON alert_rules(severity);

-- Rollback:
-- DROP TABLE IF EXISTS alert_rules;
