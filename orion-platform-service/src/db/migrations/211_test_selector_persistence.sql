-- Migration 211: Test Selector Service Persistence
--
-- Create table for PR test results used by TestSelectorService.
-- Replaces in-memory Map<string, PRTestResult> storage.

CREATE TABLE IF NOT EXISTS test_selector_pr_results (
  id            UUID PRIMARY KEY,
  tenant_id     VARCHAR(100) NOT NULL DEFAULT 'default',
  pr_id         VARCHAR(200) NOT NULL,
  plan_data     JSONB NOT NULL DEFAULT '{}',
  impact_data   JSONB NOT NULL DEFAULT '{}',
  status        VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tspr_pr_id ON test_selector_pr_results(pr_id);
CREATE INDEX IF NOT EXISTS idx_tspr_tenant_id ON test_selector_pr_results(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tspr_tenant_pr ON test_selector_pr_results(tenant_id, pr_id);
