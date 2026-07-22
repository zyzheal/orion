-- Canary-Traffic module tables (auto-generated)

CREATE TABLE IF NOT EXISTS canary_traffics (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_canary_traffics_tenant ON canary_traffics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_canary_traffics_created ON canary_traffics(created_at DESC);

