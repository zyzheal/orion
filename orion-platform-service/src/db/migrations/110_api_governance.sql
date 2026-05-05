-- 110: API Governance
-- API 契约、契约违规、API 版本

-- api_contracts 表（API 契约定义）
CREATE TABLE IF NOT EXISTS api_contracts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  api_name          VARCHAR(200) NOT NULL,
  description       TEXT,
  spec_format       VARCHAR(30) NOT NULL DEFAULT 'openapi3',    -- openapi3, graphql, grpc, asyncapi
  spec_content      JSONB NOT NULL DEFAULT '{}',
  endpoint          VARCHAR(500) NOT NULL,
  method            VARCHAR(10) NOT NULL DEFAULT 'GET',
  auth_type         VARCHAR(50) NOT NULL DEFAULT 'bearer',      -- bearer, api_key, oauth2, mutual_tls
  rate_limit        INT,
  timeout_ms        INT NOT NULL DEFAULT 30000,
  status            VARCHAR(30) NOT NULL DEFAULT 'draft',       -- draft, published, deprecated, retired
  owner_id          VARCHAR(100) NOT NULL,
  tags              JSONB NOT NULL DEFAULT '[]',
  published_at      TIMESTAMPTZ,
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_contracts_tenant ON api_contracts(tenant_id);
CREATE INDEX idx_api_contracts_name ON api_contracts(api_name);
CREATE INDEX idx_api_contracts_status ON api_contracts(status);
CREATE INDEX idx_api_contracts_format ON api_contracts(spec_format);
CREATE INDEX idx_api_contracts_owner ON api_contracts(owner_id);

-- contract_violations 表（契约违规记录）
CREATE TABLE IF NOT EXISTS contract_violations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contract_id       UUID NOT NULL REFERENCES api_contracts(id) ON DELETE CASCADE,
  violation_type    VARCHAR(50) NOT NULL,                        -- schema_change, breaking_change, rate_limit, auth_failure, timeout
  severity          VARCHAR(20) NOT NULL DEFAULT 'high',         -- critical, high, medium, low
  description       TEXT NOT NULL,
  request_details   JSONB NOT NULL DEFAULT '{}',
  expected          JSONB NOT NULL DEFAULT '{}',
  actual            JSONB NOT NULL DEFAULT '{}',
  status            VARCHAR(30) NOT NULL DEFAULT 'open',         -- open, acknowledged, resolved, waived
  resolved_by       VARCHAR(100),
  resolved_at       TIMESTAMPTZ,
  resolution_notes  TEXT,
  detected_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_contract_violations_tenant ON contract_violations(tenant_id);
CREATE INDEX idx_contract_violations_contract ON contract_violations(contract_id);
CREATE INDEX idx_contract_violations_type ON contract_violations(violation_type);
CREATE INDEX idx_contract_violations_severity ON contract_violations(severity);
CREATE INDEX idx_contract_violations_status ON contract_violations(status);
CREATE INDEX idx_contract_violations_detected ON contract_violations(detected_at DESC);

-- api_versions 表（API 版本管理）
CREATE TABLE IF NOT EXISTS api_versions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contract_id       UUID REFERENCES api_contracts(id) ON DELETE SET NULL,
  version           VARCHAR(20) NOT NULL,
  base_url          VARCHAR(500) NOT NULL,
  changelog         TEXT,
  breaking_changes  JSONB NOT NULL DEFAULT '[]',
  deprecated_endpoints JSONB NOT NULL DEFAULT '[]',
  compatibility     VARCHAR(30) NOT NULL DEFAULT 'backward',     -- backward, forward, full, breaking
  status            VARCHAR(30) NOT NULL DEFAULT 'active',       -- active, deprecated, retired
  eol_date          TIMESTAMPTZ,
  published_by      VARCHAR(100) NOT NULL,
  published_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_versions_tenant ON api_versions(tenant_id);
CREATE INDEX idx_api_versions_contract ON api_versions(contract_id);
CREATE INDEX idx_api_versions_version ON api_versions(version);
CREATE INDEX idx_api_versions_status ON api_versions(status);
CREATE INDEX idx_api_versions_eol ON api_versions(eol_date) WHERE eol_date IS NOT NULL;

-- RLS
ALTER TABLE api_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_api_contracts ON api_contracts
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_contract_violations ON contract_violations
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_api_versions ON api_versions
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
