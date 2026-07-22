-- Dual-Engine module tables (auto-generated)

CREATE TABLE IF NOT EXISTS dual_engines (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_dual_engines_tenant ON dual_engines(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dual_engines_created ON dual_engines(created_at DESC);

