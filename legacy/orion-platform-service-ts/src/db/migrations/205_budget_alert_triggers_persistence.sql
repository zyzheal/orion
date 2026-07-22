-- Migration 205: Budget alert triggers persistence
-- Stores budget alert trigger records for BudgetService

CREATE TABLE IF NOT EXISTS budget_alert_triggers (
  id            VARCHAR(64) PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  budget_id     VARCHAR(64) NOT NULL,
  threshold     NUMERIC(5,2) NOT NULL,
  actual        NUMERIC(14,2) NOT NULL,
  percentage    NUMERIC(7,2) NOT NULL,
  entity_type   VARCHAR(32) NOT NULL,
  entity_id     VARCHAR(128) NOT NULL,
  triggered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_budget_alert_triggers_tenant ON budget_alert_triggers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_budget_alert_triggers_budget ON budget_alert_triggers(budget_id);
CREATE INDEX IF NOT EXISTS idx_budget_alert_triggers_entity ON budget_alert_triggers(entity_type, entity_id);
