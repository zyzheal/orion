-- 102: Multi-Cloud
-- 云账户、云资源、云提供商

-- cloud_providers 表（云提供商定义）
CREATE TABLE IF NOT EXISTS cloud_providers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider_name     VARCHAR(100) NOT NULL,                   -- aws, azure, gcp, aliyun, tencent, huawei
  provider_type     VARCHAR(50) NOT NULL,                    -- public, private, hybrid
  api_version       VARCHAR(20),
  supported_services JSONB NOT NULL DEFAULT '[]',
  regions           JSONB NOT NULL DEFAULT '[]',
  status            VARCHAR(30) NOT NULL DEFAULT 'active',   -- active, deprecated, disabled
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cloud_providers_tenant ON cloud_providers(tenant_id);
CREATE INDEX idx_cloud_providers_name ON cloud_providers(provider_name);
CREATE INDEX idx_cloud_providers_status ON cloud_providers(status);

-- cloud_accounts 表（云账户凭据与配置）
CREATE TABLE IF NOT EXISTS cloud_accounts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider_id       UUID REFERENCES cloud_providers(id) ON DELETE SET NULL,
  account_name      VARCHAR(200) NOT NULL,
  account_id        VARCHAR(100) NOT NULL,
  credential_type   VARCHAR(30) NOT NULL DEFAULT 'access_key', -- access_key, service_account, role
  credential_ref    VARCHAR(500) NOT NULL,                    -- reference to secret store
  region            VARCHAR(100) NOT NULL DEFAULT 'default',
  status            VARCHAR(30) NOT NULL DEFAULT 'active',    -- active, suspended, expired
  monthly_budget    FLOAT,
  current_spend     FLOAT DEFAULT 0,
  tags              JSONB NOT NULL DEFAULT '{}',
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cloud_accounts_tenant ON cloud_accounts(tenant_id);
CREATE INDEX idx_cloud_accounts_provider ON cloud_accounts(provider_id);
CREATE INDEX idx_cloud_accounts_status ON cloud_accounts(status);
CREATE INDEX idx_cloud_accounts_region ON cloud_accounts(region);

-- cloud_resources 表（云资源清单）
CREATE TABLE IF NOT EXISTS cloud_resources (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_id        UUID NOT NULL REFERENCES cloud_accounts(id) ON DELETE CASCADE,
  resource_type     VARCHAR(100) NOT NULL,                     -- ec2, s3, rds, vpc, lambda, etc.
  resource_id       VARCHAR(200) NOT NULL,
  resource_name     VARCHAR(200),
  region            VARCHAR(100) NOT NULL,
  state             VARCHAR(30) NOT NULL DEFAULT 'running',    -- running, stopped, terminated, pending
  spec              JSONB NOT NULL DEFAULT '{}',
  monthly_cost      FLOAT DEFAULT 0,
  tags              JSONB NOT NULL DEFAULT '{}',
  discovered_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cloud_resources_tenant ON cloud_resources(tenant_id);
CREATE INDEX idx_cloud_resources_account ON cloud_resources(account_id);
CREATE INDEX idx_cloud_resources_type ON cloud_resources(resource_type);
CREATE INDEX idx_cloud_resources_state ON cloud_resources(state);
CREATE INDEX idx_cloud_resources_region ON cloud_resources(region);

-- RLS
ALTER TABLE cloud_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_cloud_providers ON cloud_providers
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_cloud_accounts ON cloud_accounts
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY tenant_isolation_cloud_resources ON cloud_resources
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
