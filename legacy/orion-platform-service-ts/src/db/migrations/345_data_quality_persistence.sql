-- Migration 345: Data Quality Persistence
-- Creates tables for data quality rules and check results

-- Data quality rules table
CREATE TABLE IF NOT EXISTS data_quality_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  table_name    VARCHAR(255) NOT NULL,
  column_name   VARCHAR(255),
  rule_type     VARCHAR(50) NOT NULL CHECK (rule_type IN ('not_null', 'unique', 'range', 'regex', 'custom', 'freshness', 'volume')),
  config        JSONB NOT NULL DEFAULT '{}',
  severity      VARCHAR(20) NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  enabled       BOOLEAN NOT NULL DEFAULT true,
  last_check_at TIMESTAMPTZ,
  last_status   VARCHAR(20) CHECK (last_status IN ('pass', 'fail', 'error')),
  pass_rate     DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dq_rules_tenant ON data_quality_rules(tenant_id);
CREATE INDEX idx_dq_rules_table ON data_quality_rules(table_name);
CREATE INDEX idx_dq_rules_enabled ON data_quality_rules(enabled) WHERE enabled = true;
CREATE INDEX idx_dq_rules_last_status ON data_quality_rules(last_status);

-- Data quality check results table
CREATE TABLE IF NOT EXISTS data_quality_checks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rule_id        UUID NOT NULL REFERENCES data_quality_rules(id) ON DELETE CASCADE,
  rule_name      VARCHAR(255) NOT NULL,
  status         VARCHAR(20) NOT NULL CHECK (status IN ('pass', 'fail', 'error')),
  actual_value   TEXT,
  expected_value TEXT,
  details        TEXT,
  checked_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dq_checks_rule ON data_quality_checks(rule_id);
CREATE INDEX idx_dq_checks_tenant ON data_quality_checks(tenant_id);
CREATE INDEX idx_dq_checks_checked_at ON data_quality_checks(checked_at DESC);

-- RLS for data_quality_rules
ALTER TABLE data_quality_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_quality_rules FORCE ROW LEVEL SECURITY;

CREATE POLICY dq_rules_tenant_isolation ON data_quality_rules
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- RLS for data_quality_checks
ALTER TABLE data_quality_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_quality_checks FORCE ROW LEVEL SECURITY;

CREATE POLICY dq_checks_tenant_isolation ON data_quality_checks
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

COMMENT ON TABLE data_quality_rules IS 'Data quality rule definitions for monitoring data integrity';
COMMENT ON TABLE data_quality_checks IS 'Data quality check execution results and history';
COMMENT ON COLUMN data_quality_rules.rule_type IS 'Type of quality check: not_null, unique, range, regex, custom, freshness, volume';
COMMENT ON COLUMN data_quality_rules.config IS 'JSON configuration for the rule (e.g., min/max for range, pattern for regex)';
COMMENT ON COLUMN data_quality_rules.pass_rate IS 'Historical pass rate as a percentage (0-100)';

-- Rollback:
-- DROP TABLE IF EXISTS data_quality_checks;
-- DROP TABLE IF EXISTS data_quality_rules;
