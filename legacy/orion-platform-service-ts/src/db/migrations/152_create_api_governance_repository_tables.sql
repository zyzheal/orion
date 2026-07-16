-- 152: API Governance Repository Tables
-- 为 ApiContractRepository, ApiVersionRepository, GovernanceRuleRepository, ApiInventoryRepository 创建表

-- api_contracts 表（API 契约 - Repository 使用的简化版本）
CREATE TABLE IF NOT EXISTS api_contracts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,
  name              VARCHAR(200) NOT NULL,
  description       TEXT,
  endpoint          VARCHAR(500) NOT NULL,
  method            VARCHAR(10) NOT NULL DEFAULT 'GET',
  schema            JSONB NOT NULL DEFAULT '{}',
  version           VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_contracts_tenant_id ON api_contracts(tenant_id);
CREATE INDEX idx_api_contracts_endpoint ON api_contracts(endpoint);

-- api_contract_violations 表（契约违规记录）
CREATE TABLE IF NOT EXISTS api_contract_violations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id       UUID NOT NULL REFERENCES api_contracts(id) ON DELETE CASCADE,
  violation_type    VARCHAR(50) NOT NULL,
  description       TEXT NOT NULL,
  severity          VARCHAR(20) NOT NULL DEFAULT 'high',
  detected_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  sample_data       JSONB
);
CREATE INDEX idx_api_contract_violations_contract ON api_contract_violations(contract_id);

-- api_versions 表（API 版本 - Repository 使用的版本）
CREATE TABLE IF NOT EXISTS api_versions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,
  api_id            VARCHAR(100) NOT NULL,
  version           VARCHAR(20) NOT NULL,
  definition        JSONB NOT NULL DEFAULT '{}',
  status            VARCHAR(30) NOT NULL DEFAULT 'active',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deprecated_at     TIMESTAMPTZ
);
CREATE INDEX idx_api_versions_tenant_id ON api_versions(tenant_id);
CREATE INDEX idx_api_versions_api_id ON api_versions(api_id);
CREATE INDEX idx_api_versions_status ON api_versions(status);

-- governance_rules 表（治理规则）
CREATE TABLE IF NOT EXISTS governance_rules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,
  name              VARCHAR(200) NOT NULL,
  description       TEXT,
  rule_type         VARCHAR(50) NOT NULL,
  config            JSONB NOT NULL DEFAULT '{}',
  enabled           BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_governance_rules_tenant_id ON governance_rules(tenant_id);
CREATE INDEX idx_governance_rules_type ON governance_rules(rule_type);
CREATE INDEX idx_governance_rules_enabled ON governance_rules(enabled);

-- api_inventory 表（API 清单）
CREATE TABLE IF NOT EXISTS api_inventory (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,
  api_data          JSONB NOT NULL DEFAULT '{}',
  registered_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_inventory_tenant_id ON api_inventory(tenant_id);