-- 002: Federation Service - Repository Persistence
-- MultiCloud and ResourceAbstraction repository tables

-- federation_cloud_accounts 表（多云账户管理）
CREATE TABLE IF NOT EXISTS federation_cloud_accounts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,
  account_id        VARCHAR(200) NOT NULL,
  account_name      VARCHAR(200) NOT NULL,
  credential_type   VARCHAR(50) NOT NULL,
  credential_ref    VARCHAR(500) NOT NULL,
  region            VARCHAR(100) NOT NULL,
  status            VARCHAR(30) NOT NULL DEFAULT 'active',
  provider_id       VARCHAR(200),
  tags              JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fca_tenant ON federation_cloud_accounts(tenant_id);
CREATE INDEX idx_fca_account ON federation_cloud_accounts(account_id);
CREATE INDEX idx_fca_status ON federation_cloud_accounts(status);

-- federation_cloud_resources 表（多云资源管理）
CREATE TABLE IF NOT EXISTS federation_cloud_resources (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,
  account_id        VARCHAR(200) NOT NULL,
  resource_type     VARCHAR(100) NOT NULL,
  resource_id       VARCHAR(200) NOT NULL,
  resource_name     VARCHAR(200) NOT NULL,
  region            VARCHAR(100) NOT NULL,
  state             VARCHAR(50) NOT NULL DEFAULT 'active',
  spec              JSONB NOT NULL DEFAULT '{}',
  monthly_cost      DECIMAL(12, 2) NOT NULL DEFAULT 0,
  discovered_at     TIMESTAMPTZ,
  tags              JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fcr_tenant ON federation_cloud_resources(tenant_id);
CREATE INDEX idx_fcr_account ON federation_cloud_resources(account_id);
CREATE INDEX idx_fcr_type ON federation_cloud_resources(resource_type);

-- federation_unified_resources 表（统一资源抽象）
CREATE TABLE IF NOT EXISTS federation_unified_resources (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,
  name              VARCHAR(200) NOT NULL,
  resource_type     VARCHAR(100) NOT NULL,
  provider          VARCHAR(50) NOT NULL,
  region            VARCHAR(100) NOT NULL,
  status            VARCHAR(30) NOT NULL DEFAULT 'provisioning',
  spec              JSONB NOT NULL DEFAULT '{}',
  config            JSONB NOT NULL DEFAULT '{}',
  metadata          JSONB NOT NULL DEFAULT '{}',
  tags              JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fur_tenant ON federation_unified_resources(tenant_id);
CREATE INDEX idx_fur_type ON federation_unified_resources(resource_type);
CREATE INDEX idx_fur_status ON federation_unified_resources(status);

-- federation_deployment_results 表（部署结果）
CREATE TABLE IF NOT EXISTS federation_deployment_results (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,
  resource_id       VARCHAR(200),
  status            VARCHAR(30) NOT NULL DEFAULT 'deploying',
  provider          VARCHAR(50) NOT NULL,
  region            VARCHAR(100),
  service_name      VARCHAR(200),
  resources         JSONB NOT NULL DEFAULT '[]',
  result            JSONB,
  error_message     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fdr_tenant ON federation_deployment_results(tenant_id);
CREATE INDEX idx_fdr_status ON federation_deployment_results(status);
CREATE INDEX idx_fdr_resource ON federation_deployment_results(resource_id);