-- Multi-cloud module tables

CREATE TABLE IF NOT EXISTS cloud_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    provider_id VARCHAR(255) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_id VARCHAR(255) NOT NULL,
    credential_type VARCHAR(50) NOT NULL,
    credential_ref VARCHAR(255),
    region VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    monthly_budget DOUBLE PRECISION DEFAULT 0,
    current_spend DOUBLE PRECISION DEFAULT 0,
    tags JSONB,
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cloud_accounts_tenant_id ON cloud_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cloud_accounts_provider_id ON cloud_accounts(provider_id);
CREATE INDEX IF NOT EXISTS idx_cloud_accounts_region ON cloud_accounts(region);

CREATE TABLE IF NOT EXISTS cloud_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    account_id VARCHAR(255) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    resource_id VARCHAR(255) NOT NULL,
    resource_type VARCHAR(255) NOT NULL,
    region VARCHAR(50),
    name VARCHAR(255),
    status VARCHAR(50),
    monthly_cost DOUBLE PRECISION DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cloud_resources_tenant_id ON cloud_resources(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cloud_resources_account_id ON cloud_resources(account_id);
CREATE INDEX IF NOT EXISTS idx_cloud_resources_provider ON cloud_resources(provider);

CREATE TABLE IF NOT EXISTS scheduling_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    strategy VARCHAR(50) NOT NULL,
    constraints JSONB,
    priority INTEGER DEFAULT 0,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scheduling_policies_tenant_id ON scheduling_policies(tenant_id);

CREATE TABLE IF NOT EXISTS migration_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    source_provider VARCHAR(50) NOT NULL,
    source_region VARCHAR(50) NOT NULL,
    target_provider VARCHAR(50) NOT NULL,
    target_region VARCHAR(50) NOT NULL,
    resources JSONB,
    estimated_cost DOUBLE PRECISION DEFAULT 0,
    estimated_duration INTEGER DEFAULT 0,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_migration_plans_tenant_id ON migration_plans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_migration_plans_status ON migration_plans(status);
