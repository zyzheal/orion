-- Vector-Store module tables (auto-generated)

CREATE TABLE IF NOT EXISTS vector_stores (
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

CREATE INDEX IF NOT EXISTS idx_vector_stores_tenant ON vector_stores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vector_stores_created ON vector_stores(created_at DESC);

