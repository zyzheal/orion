-- Migration 217: RuleEngine Map() to PostgreSQL
-- Migrates ruleSets, auditLog from in-memory Map/Array storage

CREATE TABLE IF NOT EXISTS ai_rule_engine_rule_sets (
  id VARCHAR(100) PRIMARY KEY,
  scenario VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  rules_json JSONB NOT NULL DEFAULT '[]',
  default_action JSONB,
  enabled BOOLEAN NOT NULL DEFAULT true,
  tenant_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_rule_engine_rule_sets_scenario ON ai_rule_engine_rule_sets(scenario);
CREATE INDEX IF NOT EXISTS idx_ai_rule_engine_rule_sets_enabled ON ai_rule_engine_rule_sets(enabled);
CREATE INDEX IF NOT EXISTS idx_ai_rule_engine_rule_sets_tenant ON ai_rule_engine_rule_sets(tenant_id);

CREATE TABLE IF NOT EXISTS ai_rule_engine_audit_log (
  id VARCHAR(100) PRIMARY KEY,
  scenario VARCHAR(100) NOT NULL,
  rule_id VARCHAR(100),
  input_json JSONB NOT NULL DEFAULT '{}',
  result_json JSONB NOT NULL DEFAULT '{}',
  event_time TIMESTAMP NOT NULL DEFAULT NOW(),
  tenant_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_rule_engine_audit_log_scenario ON ai_rule_engine_audit_log(scenario, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_ai_rule_engine_audit_log_rule ON ai_rule_engine_audit_log(rule_id);
CREATE INDEX IF NOT EXISTS idx_ai_rule_engine_audit_log_tenant ON ai_rule_engine_audit_log(tenant_id);
