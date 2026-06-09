-- Migration 176: Test Selector Relations
--
-- Extend test_cases table with relationships to pipelines, artifacts, and environments
-- This enables smart test selection based on code changes and blast radius analysis

-- 1. Add missing columns to test_cases for relationship tracking
ALTER TABLE test_cases
  ADD COLUMN IF NOT EXISTS suite_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS flaky BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS flaky_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pipeline_run_id UUID,
  ADD COLUMN IF NOT EXISTS artifact_id UUID,
  ADD COLUMN IF NOT EXISTS environment VARCHAR(50);

-- 2. Create test_suites table for organizing test cases
CREATE TABLE IF NOT EXISTS test_suites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(200) NOT NULL UNIQUE,
  description     TEXT,
  total_tests     INTEGER NOT NULL DEFAULT 0,
  passed          INTEGER NOT NULL DEFAULT 0,
  failed          INTEGER NOT NULL DEFAULT 0,
  skipped         INTEGER NOT NULL DEFAULT 0,
  tags            JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_test_suites_name ON test_suites(name);

-- 3. Create test_runs table for tracking test execution history
CREATE TABLE IF NOT EXISTS test_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suite_id          UUID REFERENCES test_suites(id) ON DELETE SET NULL,
  pipeline_run_id   UUID,
  artifact_id       UUID,
  environment       VARCHAR(50),
  status            VARCHAR(20) NOT NULL,  -- running, passed, failed, cancelled
  total_tests       INTEGER NOT NULL DEFAULT 0,
  passed            INTEGER NOT NULL DEFAULT 0,
  failed            INTEGER NOT NULL DEFAULT 0,
  skipped           INTEGER NOT NULL DEFAULT 0,
  duration_ms       INTEGER NOT NULL DEFAULT 0,
  coverage_rate     DECIMAL(5,2),
  triggered_by      VARCHAR(100),
  commit_sha        VARCHAR(40),
  branch            VARCHAR(100),
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ
);

CREATE INDEX idx_test_runs_suite ON test_runs(suite_id);
CREATE INDEX idx_test_runs_pipeline_run ON test_runs(pipeline_run_id);
CREATE INDEX idx_test_runs_status ON test_runs(status);
CREATE INDEX idx_test_runs_started ON test_runs(started_at DESC);

-- 4. Create test_tags table for flexible tagging
CREATE TABLE IF NOT EXISTS test_tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(50) NOT NULL UNIQUE,
  color       VARCHAR(7) DEFAULT '#3370E6',
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Create junction table for test_case <-> test_tag
CREATE TABLE IF NOT EXISTS test_case_tags (
  test_case_id UUID REFERENCES test_cases(id) ON DELETE CASCADE,
  tag_id       UUID REFERENCES test_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (test_case_id, tag_id)
);

-- 6. Add foreign key constraints (with existence check)
-- Note: pipeline_runs and artifact_registry tables must exist before this migration
DO $$
BEGIN
  -- Check if pipeline_runs exists before adding FK
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pipeline_runs') THEN
    ALTER TABLE test_cases
      ADD CONSTRAINT fk_test_cases_pipeline_run
      FOREIGN KEY (pipeline_run_id) REFERENCES pipeline_runs(id) ON DELETE SET NULL;
  END IF;

  -- Check if artifact_registry exists before adding FK
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'artifact_registry') THEN
    ALTER TABLE test_cases
      ADD CONSTRAINT fk_test_cases_artifact
      FOREIGN KEY (artifact_id) REFERENCES artifact_registry(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 7. Create test_coverage table for tracking code coverage
CREATE TABLE IF NOT EXISTS test_coverage (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_run_id     UUID REFERENCES test_runs(id) ON DELETE CASCADE,
  artifact_id     UUID,
  line_coverage   DECIMAL(5,2),
  branch_coverage DECIMAL(5,2),
  files_covered   INTEGER DEFAULT 0,
  files_total     INTEGER DEFAULT 0,
  coverage_json   JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_test_coverage_run ON test_coverage(test_run_id);
CREATE INDEX idx_test_coverage_artifact ON test_coverage(artifact_id);

-- 8. Insert sample test suites data
INSERT INTO test_suites (name, description, total_tests, passed, failed, skipped, tags) VALUES
  ('unit-tests', 'Core unit tests', 150, 145, 3, 2, '["unit", "core", "critical"]'),
  ('integration-tests', 'Integration test suite', 80, 75, 2, 3, '["integration", "api"]'),
  ('e2e-tests', 'End-to-end test suite', 45, 42, 1, 2, '["e2e", "ui", "smoke"]'),
  ('performance-tests', 'Performance and load tests', 25, 23, 0, 2, '["performance", "load"]'),
  ('security-tests', 'Security scanning tests', 30, 28, 1, 1, '["security", "audit"]')
ON CONFLICT (name) DO NOTHING;

-- 9. Insert sample test tags
INSERT INTO test_tags (name, color, description) VALUES
  ('critical', '#f5222d', 'Critical test - must pass'),
  ('smoke', '#faad14', 'Smoke test - quick sanity check'),
  ('regression', '#3370E6', 'Regression test'),
  ('flaky', '#8c8c8c', 'Flaky test - may fail randomly'),
  ('slow', '#722ed1', 'Slow running test'),
  ('api', '#13c2c2', 'API test'),
  ('ui', '#eb2f96', 'UI test'),
  ('database', '#52c41a', 'Database test')
ON CONFLICT (name) DO NOTHING;

-- Rollback:
-- DROP TABLE IF EXISTS test_case_tags;
-- DROP TABLE IF EXISTS test_coverage;
-- DROP TABLE IF EXISTS test_runs;
-- DROP TABLE IF EXISTS test_tags;
-- DROP TABLE IF EXISTS test_suites;
-- ALTER TABLE test_cases DROP COLUMN IF EXISTS suite_name;
-- ALTER TABLE test_cases DROP COLUMN IF EXISTS tags;
-- ALTER TABLE test_cases DROP COLUMN IF EXISTS flaky;
-- ALTER TABLE test_cases DROP COLUMN IF EXISTS flaky_count;
-- ALTER TABLE test_cases DROP COLUMN IF EXISTS last_run_at;
-- ALTER TABLE test_cases DROP COLUMN IF EXISTS pipeline_run_id;
-- ALTER TABLE test_cases DROP COLUMN IF EXISTS artifact_id;
-- ALTER TABLE test_cases DROP COLUMN IF EXISTS environment;