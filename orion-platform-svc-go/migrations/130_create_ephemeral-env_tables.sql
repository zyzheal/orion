-- Ephemeral-Env module tables (auto-generated)

CREATE TABLE IF NOT EXISTS ephemeral_envs (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    environment_name VARCHAR(255) NOT NULL,
    ttl_seconds BIGINT NOT NULL,
    status VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_ephemeral_envs_tenant ON ephemeral_envs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ephemeral_envs_created ON ephemeral_envs(created_at DESC);

