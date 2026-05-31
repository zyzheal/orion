-- Migration 292: CostCalculator Map() to PostgreSQL
-- Migrates cost estimates and ROI calculations from in-memory storage

CREATE TABLE IF NOT EXISTS cost_estimates (
  id VARCHAR(100) PRIMARY KEY,
  model VARCHAR(200) NOT NULL,
  provider VARCHAR(200) NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  input_cost NUMERIC(16,8) NOT NULL DEFAULT 0,
  output_cost NUMERIC(16,8) NOT NULL DEFAULT 0,
  total_cost NUMERIC(16,8) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  tenant_id VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cost_estimates_model ON cost_estimates(model, provider);
CREATE INDEX IF NOT EXISTS idx_cost_estimates_created_at ON cost_estimates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cost_estimates_tenant ON cost_estimates(tenant_id);
