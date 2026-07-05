-- Migration: 308_billing_persistence.sql
-- Purpose: Ensure billing tables have optimal indexes for BillingRepository queries.
-- Tables were originally created in 070_create_billing_tables.sql.
-- This migration is idempotent (uses IF NOT EXISTS).

-- Additional indexes for billing_usage_records
CREATE INDEX IF NOT EXISTS idx_billing_usage_service ON billing_usage_records(service);
CREATE INDEX IF NOT EXISTS idx_billing_usage_metric ON billing_usage_records(metric);
CREATE INDEX IF NOT EXISTS idx_billing_usage_created ON billing_usage_records(created_at DESC);

-- Additional indexes for billing_records
CREATE INDEX IF NOT EXISTS idx_billing_records_updated ON billing_records(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_records_due_date ON billing_records(due_date) WHERE due_date IS NOT NULL;
