-- Multi-Cloud module tables (auto-generated)

CREATE TABLE IF NOT EXISTS cloud_accounts (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    provider_id VARCHAR(255) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_id VARCHAR(255) NOT NULL,
    credential_type VARCHAR(255) NOT NULL,
    credential_ref VARCHAR(255) NOT NULL,
    region VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    monthly_budget DOUBLE PRECISION NOT NULL,
    current_spend DOUBLE PRECISION NOT NULL,
    tags VARCHAR(255) NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_cloud_accounts_tenant ON cloud_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cloud_accounts_created ON cloud_accounts(created_at DESC);

CREATE TABLE IF NOT EXISTS cloud_resources (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    account_id VARCHAR(255) NOT NULL,
    provider VARCHAR(255) NOT NULL,
    resource_id VARCHAR(255) NOT NULL,
    resource_type VARCHAR(255) NOT NULL,
    region VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    monthly_cost DOUBLE PRECISION NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_cloud_resources_tenant ON cloud_resources(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cloud_resources_created ON cloud_resources(created_at DESC);

CREATE TABLE IF NOT EXISTS scheduling_policies (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    strategy VARCHAR(255) NOT NULL,
    constraints VARCHAR(255) NOT NULL,
    priority BIGINT NOT NULL,
    enabled BOOLEAN NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_scheduling_policies_tenant ON scheduling_policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scheduling_policies_created ON scheduling_policies(created_at DESC);

CREATE TABLE IF NOT EXISTS migration_plans (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    source_provider VARCHAR(255) NOT NULL,
    source_region VARCHAR(255) NOT NULL,
    target_provider VARCHAR(255) NOT NULL,
    target_region VARCHAR(255) NOT NULL,
    resources VARCHAR(255) NOT NULL,
    estimated_cost DOUBLE PRECISION NOT NULL,
    estimated_duration BIGINT NOT NULL,
    status VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_migration_plans_tenant ON migration_plans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_migration_plans_created ON migration_plans(created_at DESC);

