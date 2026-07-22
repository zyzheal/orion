-- Ai-Decision module tables (auto-generated)

CREATE TABLE IF NOT EXISTS decisions (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    context VARCHAR(255) NOT NULL,
    choice VARCHAR(255) NOT NULL,
    confidence DOUBLE PRECISION NOT NULL,
    status VARCHAR(255) NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_decisions_tenant ON decisions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_decisions_created ON decisions(created_at DESC);

