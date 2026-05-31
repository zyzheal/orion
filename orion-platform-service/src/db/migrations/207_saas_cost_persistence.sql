-- Migration 207: SaaS cost subscriptions persistence
-- Note: saas_cost_subscriptions table may already exist from BudgetSpendRepository.
-- This migration ensures the table has all required columns for SaaSCostTracker.

CREATE TABLE IF NOT EXISTS saas_cost_subscriptions (
  id              VARCHAR(64) PRIMARY KEY,
  tenant_id       VARCHAR(64),
  tool            VARCHAR(128) NOT NULL,
  subscription    VARCHAR(256),
  seats           INTEGER NOT NULL DEFAULT 0,
  unit_cost       NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_cost      NUMERIC(14,2) NOT NULL DEFAULT 0,
  billing_cycle   VARCHAR(32) NOT NULL DEFAULT 'monthly',
  start_date      TIMESTAMPTZ,
  end_date        TIMESTAMPTZ,
  status          VARCHAR(32) NOT NULL DEFAULT 'active',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saas_cost_subscriptions_tenant ON saas_cost_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_saas_cost_subscriptions_tool ON saas_cost_subscriptions(tool);
CREATE INDEX IF NOT EXISTS idx_saas_cost_subscriptions_status ON saas_cost_subscriptions(status);
