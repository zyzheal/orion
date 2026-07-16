-- API Governance Tables
-- Migration 398

-- API contracts: registered API contract definitions
CREATE TABLE IF NOT EXISTS api_contracts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  api_name TEXT NOT NULL,
  version TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  request_schema JSONB NOT NULL DEFAULT '{}',
  response_schema JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated', 'retired')),
  deprecation_date TIMESTAMPTZ,
  retirement_date TIMESTAMPTZ,
  replacement_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_contracts_tenant ON api_contracts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_contracts_api_name ON api_contracts(api_name);
CREATE INDEX IF NOT EXISTS idx_api_contracts_status ON api_contracts(status);
CREATE INDEX IF NOT EXISTS idx_api_contracts_created_at ON api_contracts(created_at DESC);

-- API contract violations: compliance violations per contract
CREATE TABLE IF NOT EXISTS api_contract_violations (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL REFERENCES api_contracts(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  violation_type TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('critical', 'warning', 'info')),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_violations_contract ON api_contract_violations(contract_id);
CREATE INDEX IF NOT EXISTS idx_api_violations_tenant ON api_contract_violations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_violations_severity ON api_contract_violations(severity);
CREATE INDEX IF NOT EXISTS idx_api_violations_detected_at ON api_contract_violations(detected_at DESC);

-- API versions: version registry with deprecation tracking
CREATE TABLE IF NOT EXISTS api_versions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  api_name TEXT NOT NULL,
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated', 'retired')),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deprecation_date TIMESTAMPTZ,
  retirement_date TIMESTAMPTZ,
  replacement_version TEXT,
  changelog TEXT
);

CREATE INDEX IF NOT EXISTS idx_api_versions_tenant ON api_versions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_versions_api_name ON api_versions(api_name);
CREATE INDEX IF NOT EXISTS idx_api_versions_status ON api_versions(status);
CREATE INDEX IF NOT EXISTS idx_api_versions_registered_at ON api_versions(registered_at DESC);

-- Governance rules: configurable governance policies
CREATE TABLE IF NOT EXISTS governance_rules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_governance_rules_tenant ON governance_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_governance_rules_enabled ON governance_rules(enabled);

-- API verification history: contract verification results
CREATE TABLE IF NOT EXISTS api_verification_history (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL REFERENCES api_contracts(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  passed BOOLEAN NOT NULL,
  violations JSONB NOT NULL DEFAULT '[]',
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_verification_contract ON api_verification_history(contract_id);
CREATE INDEX IF NOT EXISTS idx_api_verification_tenant ON api_verification_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_verification_verified_at ON api_verification_history(verified_at DESC);
