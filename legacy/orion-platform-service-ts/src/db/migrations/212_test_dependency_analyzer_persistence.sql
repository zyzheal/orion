-- Migration 212: Test Dependency Analyzer Persistence
--
-- Create tables for test suites, cases, and code mappings used by TestDependencyAnalyzer.
-- Replaces in-memory Map storage for dependency analysis data.

-- Test suites (test files)
CREATE TABLE IF NOT EXISTS test_selector_suites (
  id            UUID PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  name          VARCHAR(200) NOT NULL,
  file_path     TEXT NOT NULL,
  test_count    INTEGER NOT NULL DEFAULT 0,
  avg_duration  INTEGER NOT NULL DEFAULT 0,
  pass_rate     DECIMAL(5,2) NOT NULL DEFAULT 1.0,
  last_run      TIMESTAMPTZ,
  source_files  JSONB NOT NULL DEFAULT '[]',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tss_tenant_id ON test_selector_suites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tss_name ON test_selector_suites(name);

-- Test cases (individual tests within suites)
CREATE TABLE IF NOT EXISTS test_selector_cases (
  id            UUID PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  suite_id      VARCHAR(200) NOT NULL,
  name          VARCHAR(200) NOT NULL,
  file_path     TEXT NOT NULL,
  dependencies  JSONB NOT NULL DEFAULT '[]',
  avg_duration  INTEGER NOT NULL DEFAULT 0,
  flaky_score   INTEGER NOT NULL DEFAULT 0,
  history       JSONB NOT NULL DEFAULT '[]',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tsc_suite_id ON test_selector_cases(suite_id);
CREATE INDEX IF NOT EXISTS idx_tsc_tenant_id ON test_selector_cases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tsc_tenant_suite ON test_selector_cases(tenant_id, suite_id);

-- Test-to-code mappings
CREATE TABLE IF NOT EXISTS test_selector_code_mappings (
  id              UUID PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  test_path       TEXT NOT NULL,
  source_paths    JSONB NOT NULL DEFAULT '[]',
  symbol_mapping  JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tscm_tenant_id ON test_selector_code_mappings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tscm_test_path ON test_selector_code_mappings(test_path);
