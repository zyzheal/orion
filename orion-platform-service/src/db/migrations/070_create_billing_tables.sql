-- Migration 070: Billing Tables
-- Create billing_usage_records and billing_records tables for BillingService persistence

-- Usage records table
CREATE TABLE IF NOT EXISTS billing_usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  service VARCHAR(100) NOT NULL,
  metric VARCHAR(100) NOT NULL,
  quantity DECIMAL(20,4) NOT NULL,
  unit_price DECIMAL(20,4) NOT NULL,
  total_cost DECIMAL(20,4) NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_billing_usage_tenant ON billing_usage_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_billing_usage_period ON billing_usage_records(tenant_id, period_start);

-- Billing records table
CREATE TABLE IF NOT EXISTS billing_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  billing_period VARCHAR(7) NOT NULL, -- "2026-05"
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  total_amount DECIMAL(20,4) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(20,4) NOT NULL DEFAULT 0,
  due_date DATE,
  paid_at TIMESTAMPTZ,
  items JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_billing_records_tenant ON billing_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_billing_records_period ON billing_records(tenant_id, billing_period);
CREATE INDEX IF NOT EXISTS idx_billing_records_status ON billing_records(tenant_id, status);
