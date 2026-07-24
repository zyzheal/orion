-- Auth-Enhanced module tables (auto-generated)

CREATE TABLE IF NOT EXISTS auth_keies (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    key_id VARCHAR(255) NOT NULL,
    algorithm VARCHAR(255) NOT NULL,
    public_key VARCHAR(255) NOT NULL,
    secret VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_auth_keies_tenant ON auth_keies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_auth_keies_created ON auth_keies(created_at DESC);

CREATE TABLE IF NOT EXISTS auth_token_blacklists (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    token_id VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    reason VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_auth_token_blacklists_tenant ON auth_token_blacklists(tenant_id);
CREATE INDEX IF NOT EXISTS idx_auth_token_blacklists_created ON auth_token_blacklists(created_at DESC);

