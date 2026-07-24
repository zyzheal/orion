-- Env-Lifecycle module tables (auto-generated)

CREATE TABLE IF NOT EXISTS env_lifecycles (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_env_lifecycles_tenant ON env_lifecycles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_env_lifecycles_created ON env_lifecycles(created_at DESC);

