-- Tenant-Gateway module tables (auto-generated)

CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    tier VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    namespace_pool_id VARCHAR(255) NOT NULL,
    owner_email VARCHAR(255) NOT NULL,
    business_unit VARCHAR(255) NOT NULL,
    cost_center VARCHAR(255) NOT NULL,
    expires_at BIGINT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_tenants_tenant ON tenants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenants_created ON tenants(created_at DESC);

