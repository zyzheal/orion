-- Migration 142: Test Reports and Test Cases
--
-- Store test execution results from CI pipeline runs.
-- Separate tables for report summaries and individual test cases
-- to avoid embedding large numbers of cases as JSONB.

CREATE TABLE IF NOT EXISTS test_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        UUID NOT NULL,
  stage_id      UUID NOT NULL,
  task_id       UUID NOT NULL,
  format        VARCHAR(20) NOT NULL,               -- junit, jest, pytest, go, allure, custom
  total_tests   INTEGER NOT NULL DEFAULT 0,
  passed        INTEGER NOT NULL DEFAULT 0,
  failed        INTEGER NOT NULL DEFAULT 0,
  skipped       INTEGER NOT NULL DEFAULT 0,
  duration_ms   INTEGER NOT NULL DEFAULT 0,
  coverage_json JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS test_cases (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id     UUID NOT NULL REFERENCES test_reports(id) ON DELETE CASCADE,
  name          VARCHAR(500) NOT NULL,
  class_name    VARCHAR(500),
  status        VARCHAR(20) NOT NULL,               -- passed, failed, skipped
  duration_ms   INTEGER,
  error_message TEXT,
  stack_trace   TEXT
);

CREATE INDEX idx_test_cases_report ON test_cases(report_id);
CREATE INDEX idx_test_cases_status ON test_cases(status);
CREATE INDEX idx_test_reports_run ON test_reports(run_id);

-- Rollback:
-- DROP TABLE IF EXISTS test_cases;
-- DROP TABLE IF EXISTS test_reports;
