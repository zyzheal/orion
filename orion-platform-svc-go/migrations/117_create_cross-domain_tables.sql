-- Cross-Domain module tables (auto-generated)

CREATE TABLE IF NOT EXISTS cross_domains (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_cross_domains_tenant ON cross_domains(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cross_domains_created ON cross_domains(created_at DESC);

