-- 001: Governance Tables
-- Policy definitions, bundles, evaluations, violations, overrides, exemptions,
-- API contracts, contract violations, API versions, governance rules, API inventory.

-- policy_definitions: policy definitions (Rego-backed or metadata-only)
CREATE TABLE IF NOT EXISTS policy_definitions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   VARCHAR(64) NOT NULL,
  name        VARCHAR(256) NOT NULL,
  description TEXT,
  category    VARCHAR(64) NOT NULL DEFAULT 'governance',
  rego_path   VARCHAR(512) NOT NULL DEFAULT '',
  gate_id     VARCHAR(100),
  severity    VARCHAR(16) NOT NULL DEFAULT 'medium',
  enabled     BOOLEAN NOT NULL DEFAULT true,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_policy_definitions_tenant ON policy_definitions(tenant_id, created_at);
CREATE INDEX idx_policy_definitions_category ON policy_definitions(tenant_id, category);
CREATE INDEX idx_policy_definitions_gate ON policy_definitions(gate_id) WHERE gate_id IS NOT NULL;

-- policy_bundles: grouped policies with versioning
CREATE TABLE IF NOT EXISTS policy_bundles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  VARCHAR(64) NOT NULL,
  name       VARCHAR(256) NOT NULL,
  version    VARCHAR(50) NOT NULL DEFAULT '1.0.0',
  policies   JSONB NOT NULL DEFAULT '[]',
  active     BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_policy_bundles_tenant ON policy_bundles(tenant_id);

-- policy_evaluations: results of policy checks per run
CREATE TABLE IF NOT EXISTS policy_evaluations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id     UUID REFERENCES policy_definitions(id) ON DELETE SET NULL,
  run_id        VARCHAR(100) NOT NULL,
  input_context JSONB NOT NULL DEFAULT '{}',
  result        JSONB NOT NULL DEFAULT '{}',
  evaluated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  evaluation_ms INT
);
CREATE INDEX idx_policy_evaluations_run_id ON policy_evaluations(run_id);
CREATE INDEX idx_policy_evaluations_policy_id ON policy_evaluations(policy_id) WHERE policy_id IS NOT NULL;
CREATE INDEX idx_policy_evaluations_evaluated ON policy_evaluations(evaluated_at DESC);

-- policy_violations: violations emitted during evaluation
CREATE TABLE IF NOT EXISTS policy_violations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID REFERENCES policy_evaluations(id) ON DELETE SET NULL,
  policy_id     UUID REFERENCES policy_definitions(id) ON DELETE SET NULL,
  severity      VARCHAR(16) NOT NULL DEFAULT 'medium',
  message       TEXT NOT NULL,
  resource_type VARCHAR(64),
  resource_id   VARCHAR(128),
  status        VARCHAR(20) NOT NULL DEFAULT 'open',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_policy_violations_status ON policy_violations(status);
CREATE INDEX idx_policy_violations_severity ON policy_violations(severity);
CREATE INDEX idx_policy_violations_policy_id ON policy_violations(policy_id) WHERE policy_id IS NOT NULL;

-- policy_overrides: approved overrides for blocked policies
CREATE TABLE IF NOT EXISTS policy_overrides (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   VARCHAR(64) NOT NULL,
  policy_id   UUID NOT NULL REFERENCES policy_definitions(id),
  pipeline_id VARCHAR(100),
  run_id      VARCHAR(100),
  violation_id UUID REFERENCES policy_violations(id) ON DELETE SET NULL,
  reason      TEXT NOT NULL,
  approved_by VARCHAR(100) NOT NULL,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status      VARCHAR(20) NOT NULL DEFAULT 'active',
  expires_at  TIMESTAMPTZ,
  scope       VARCHAR(64),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at  TIMESTAMPTZ,
  revoked_by  VARCHAR(100)
);
CREATE INDEX idx_policy_overrides_tenant ON policy_overrides(tenant_id);
CREATE INDEX idx_policy_overrides_policy ON policy_overrides(policy_id);
CREATE INDEX idx_policy_overrides_status ON policy_overrides(status);

-- policy_exemptions: exemption requests with approval chain
CREATE TABLE IF NOT EXISTS policy_exemptions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  violation_id   UUID REFERENCES policy_violations(id) ON DELETE SET NULL,
  policy_id      UUID REFERENCES policy_definitions(id) ON DELETE SET NULL,
  run_id         VARCHAR(100) NOT NULL,
  reason         TEXT NOT NULL,
  category       VARCHAR(30) NOT NULL DEFAULT 'temporary',
  requested_by   VARCHAR(100) NOT NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'pending',
  expires_at     TIMESTAMPTZ,
  approval_chain JSONB NOT NULL DEFAULT '[]',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_policy_exemptions_status ON policy_exemptions(status);
CREATE INDEX idx_policy_exemptions_policy_id ON policy_exemptions(policy_id) WHERE policy_id IS NOT NULL;
CREATE INDEX idx_policy_exemptions_category ON policy_exemptions(category);

-- api_contracts: API contract definitions (service name + endpoint + schema)
CREATE TABLE IF NOT EXISTS api_contracts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      VARCHAR(64) NOT NULL,
  service_name   VARCHAR(200) NOT NULL DEFAULT '',
  name           VARCHAR(256) NOT NULL,
  description    TEXT,
  endpoint       VARCHAR(500) NOT NULL,
  method         VARCHAR(10) NOT NULL DEFAULT 'GET',
  version        VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  spec           JSONB NOT NULL DEFAULT '{}',
  schema         JSONB NOT NULL DEFAULT '{}',
  status         VARCHAR(20) NOT NULL DEFAULT 'active',
  last_verified_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_api_contracts_tenant ON api_contracts(tenant_id, created_at);
CREATE INDEX idx_api_contracts_service ON api_contracts(service_name);
CREATE INDEX idx_api_contracts_status ON api_contracts(status);

-- api_contract_violations: violations detected during contract evaluation
CREATE TABLE IF NOT EXISTS api_contract_violations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id    UUID NOT NULL REFERENCES api_contracts(id) ON DELETE CASCADE,
  violation_type VARCHAR(50) NOT NULL,
  description    TEXT NOT NULL,
  severity       VARCHAR(20) NOT NULL DEFAULT 'high',
  detected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sample_data    JSONB
);
CREATE INDEX idx_api_contract_violations_contract ON api_contract_violations(contract_id);

-- api_versions: version management per contract / api
CREATE TABLE IF NOT EXISTS api_versions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         VARCHAR(64) NOT NULL,
  contract_id       UUID REFERENCES api_contracts(id) ON DELETE SET NULL,
  api_id            VARCHAR(100) NOT NULL DEFAULT '',
  version_tag       VARCHAR(50) NOT NULL DEFAULT '',
  version           VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  definition        JSONB NOT NULL DEFAULT '{}',
  status            VARCHAR(20) NOT NULL DEFAULT 'active',
  deprecation_date  TIMESTAMPTZ,
  retirement_date   TIMESTAMPTZ,
  replacement_version VARCHAR(50),
  changelog         TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_api_versions_tenant ON api_versions(tenant_id);
CREATE INDEX idx_api_versions_contract ON api_versions(contract_id) WHERE contract_id IS NOT NULL;
CREATE INDEX idx_api_versions_api_id ON api_versions(api_id);
CREATE INDEX idx_api_versions_status ON api_versions(status);

-- governance_rules: rule definitions for governance evaluation
CREATE TABLE IF NOT EXISTS governance_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   VARCHAR(64) NOT NULL,
  name        VARCHAR(200) NOT NULL,
  description TEXT,
  rule_type   VARCHAR(50) NOT NULL,
  config      JSONB NOT NULL DEFAULT '{}',
  enabled     BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_governance_rules_tenant ON governance_rules(tenant_id);
CREATE INDEX idx_governance_rules_type ON governance_rules(rule_type);
CREATE INDEX idx_governance_rules_enabled ON governance_rules(enabled);

-- api_inventory: registered API inventory entries
CREATE TABLE IF NOT EXISTS api_inventory (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  VARCHAR(64) NOT NULL,
  api_path   VARCHAR(500) NOT NULL DEFAULT '',
  api_data   JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_api_inventory_tenant ON api_inventory(tenant_id);

