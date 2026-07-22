-- Sso-Unified module tables (auto-generated)

CREATE TABLE IF NOT EXISTS s_s_o_configs (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    provider VARCHAR(255) NOT NULL,
    enabled BOOLEAN NOT NULL,
    config VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_s_s_o_configs_tenant ON s_s_o_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_s_s_o_configs_created ON s_s_o_configs(created_at DESC);

