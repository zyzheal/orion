-- Migration: 156_pipeline_budget.sql
-- Description: Pipeline Budget Management - set budgets, track usage, auto-block on overage

CREATE TABLE IF NOT EXISTS pipeline_budgets (
  id           VARCHAR(255) PRIMARY KEY,
  pipeline_id  UUID NOT NULL,
  max_cost     DECIMAL(10,2) NOT NULL,
  current_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency     VARCHAR(10) NOT NULL DEFAULT 'USD',
  blocked      BOOLEAN NOT NULL DEFAULT false,
  created_by   VARCHAR(255) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_budget_pipeline ON pipeline_budgets(pipeline_id);
CREATE INDEX idx_budget_blocked ON pipeline_budgets(blocked);
