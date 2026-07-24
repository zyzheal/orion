-- Canary-Analysis module tables (auto-generated)

CREATE TABLE IF NOT EXISTS analysises (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    metadata VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_analysises_tenant ON analysises(tenant_id);
CREATE INDEX IF NOT EXISTS idx_analysises_created ON analysises(created_at DESC);

