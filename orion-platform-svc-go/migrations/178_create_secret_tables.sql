-- Secret module tables (auto-generated)

CREATE TABLE IF NOT EXISTS secrets (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    encrypted_value TEXT NOT NULL,
    scope VARCHAR(255) NOT NULL,
    description VARCHAR(255) NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_secrets_tenant ON secrets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_secrets_created ON secrets(created_at DESC);

