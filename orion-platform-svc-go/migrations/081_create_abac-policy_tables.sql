-- Abac-Policy module tables (auto-generated)

CREATE TABLE IF NOT EXISTS a_b_a_c_policies (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(255) NOT NULL,
    resource_type VARCHAR(255) NOT NULL,
    action VARCHAR(255) NOT NULL,
    effect VARCHAR(255) NOT NULL,
    conditions VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_a_b_a_c_policies_tenant ON a_b_a_c_policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_a_b_a_c_policies_created ON a_b_a_c_policies(created_at DESC);

