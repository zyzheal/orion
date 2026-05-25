-- Migration: 188_create_billing_tables.sql
-- Purpose: Create tables for billing and usage metering (Phase 4 - Quota & Billing)

-- Usage Metering (resource consumption tracking)
CREATE TABLE IF NOT EXISTS billing_usage_metering (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   BIGINT NOT NULL DEFAULT 1,
    service     VARCHAR(100) NOT NULL,  -- e.g. compute, storage, network, api-calls
    metric      VARCHAR(100) NOT NULL,  -- e.g. cpu-hours, gb-storage, requests
    quantity    DECIMAL(18,6) NOT NULL DEFAULT 0,
    unit_price  DECIMAL(10,4) NOT NULL DEFAULT 0,  -- price per unit
    total_cost  DECIMAL(12,2) NOT NULL DEFAULT 0,  -- quantity * unit_price
    period_start TIMESTAMPTZ NOT NULL,
    period_end  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    metadata    JSONB
);

CREATE INDEX IF NOT EXISTS idx_billing_usage_tenant ON billing_usage_metering(tenant_id);
CREATE INDEX IF NOT EXISTS idx_billing_usage_period ON billing_usage_metering(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_billing_usage_service ON billing_usage_metering(service);

-- Billing Records (monthly invoices)
CREATE TABLE IF NOT EXISTS billing_records (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   BIGINT NOT NULL DEFAULT 1,
    billing_period VARCHAR(7) NOT NULL,  -- e.g. "2026-05"
    status      VARCHAR(20) DEFAULT 'draft',  -- draft, pending, paid, overdue, cancelled
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    paid_amount  DECIMAL(12,2) DEFAULT 0,
    due_date     DATE,
    paid_at      TIMESTAMPTZ,
    items        JSONB,  -- breakdown of charges
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_billing_status CHECK (status IN ('draft', 'pending', 'paid', 'overdue', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_billing_records_tenant ON billing_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_billing_records_period ON billing_records(billing_period);
CREATE INDEX IF NOT EXISTS idx_billing_records_status ON billing_records(status);
