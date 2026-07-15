-- Vectorize-Rules module tables (auto-generated)

CREATE TABLE IF NOT EXISTS vectorize_ruleses (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    value VARCHAR(255) NOT NULL,
    enabled BOOLEAN NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_vectorize_ruleses_tenant ON vectorize_ruleses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vectorize_ruleses_created ON vectorize_ruleses(created_at DESC);

