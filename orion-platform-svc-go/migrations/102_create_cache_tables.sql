-- Cache module tables (auto-generated)

CREATE TABLE IF NOT EXISTS cache_entries (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_cache_entries_tenant ON cache_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cache_entries_created ON cache_entries(created_at DESC);

