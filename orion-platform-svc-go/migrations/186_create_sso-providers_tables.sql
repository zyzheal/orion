-- Sso-Providers module tables (auto-generated)

CREATE TABLE IF NOT EXISTS s_s_o_providers (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(255) NOT NULL,
    enabled BOOLEAN NOT NULL,
    config VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_s_s_o_providers_tenant ON s_s_o_providers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_s_s_o_providers_created ON s_s_o_providers(created_at DESC);

