-- Migration 210: Test Failure Predictor Persistence
--
-- Create table for test execution history used by TestFailurePredictor.
-- Replaces in-memory Map<string, TestExecutionRecord[]> storage.

CREATE TABLE IF NOT EXISTS test_selector_execution_history (
  id               UUID PRIMARY KEY,
  tenant_id        VARCHAR(100) NOT NULL DEFAULT 'default',
  test_id          VARCHAR(200) NOT NULL,
  execution_id     VARCHAR(200) NOT NULL,
  passed           BOOLEAN NOT NULL DEFAULT FALSE,
  duration         INTEGER NOT NULL DEFAULT 0,
  failure_message  TEXT,
  pr_id            VARCHAR(200),
  executed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tseh_test_id ON test_selector_execution_history(test_id);
CREATE INDEX IF NOT EXISTS idx_tseh_tenant_id ON test_selector_execution_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tseh_executed_at ON test_selector_execution_history(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_tseh_tenant_test ON test_selector_execution_history(tenant_id, test_id);
