-- Migration 256: CMDB Validator Tables
-- Tables for CMDB validation rule definitions and validation execution results.
--
-- Tables:
--   cmdb_validation_rules  -- Validation rule definitions (format/range/reference/enum/custom/relationship/uniqueness)
--   cmdb_validation_results -- Per-rule validation execution history
--
-- Rollback: 256_create_cmdb_validator_tables_down.sql

CREATE TABLE IF NOT EXISTS cmdb_validation_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     VARCHAR(64) NOT NULL,
  name          VARCHAR(200) NOT NULL,
  category      VARCHAR(30) NOT NULL DEFAULT 'custom',
  target_type   VARCHAR(30) NOT NULL DEFAULT 'CI',
  condition     TEXT NOT NULL DEFAULT '{}',
  error_message TEXT,
  severity      VARCHAR(10) NOT NULL DEFAULT 'error',
  enabled       BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cmdb_rules_tenant ON cmdb_validation_rules(tenant_id);
CREATE INDEX idx_cmdb_rules_category ON cmdb_validation_rules(category);
CREATE INDEX idx_cmdb_rules_target_type ON cmdb_validation_rules(target_type);
CREATE INDEX idx_cmdb_rules_enabled ON cmdb_validation_rules(enabled);

CREATE TABLE IF NOT EXISTS cmdb_validation_results (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   VARCHAR(64) NOT NULL,
  rule_id     UUID NOT NULL REFERENCES cmdb_validation_rules(id) ON DELETE CASCADE,
  target_id   VARCHAR(255) NOT NULL,
  status      VARCHAR(10) NOT NULL DEFAULT 'pass',
  message     TEXT,
  details     TEXT NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cmdb_results_tenant ON cmdb_validation_results(tenant_id);
CREATE INDEX idx_cmdb_results_rule_id ON cmdb_validation_results(rule_id);
CREATE INDEX idx_cmdb_results_target_id ON cmdb_validation_results(target_id);
CREATE INDEX idx_cmdb_results_status ON cmdb_validation_results(status);
CREATE INDEX idx_cmdb_results_created_at ON cmdb_validation_results(created_at DESC);
