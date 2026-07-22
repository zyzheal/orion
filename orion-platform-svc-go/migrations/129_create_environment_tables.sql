-- Environment module tables (auto-generated)

CREATE TABLE IF NOT EXISTS environments (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(255) NOT NULL,
    project_id VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    locked BOOLEAN NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    updated_by VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_environments_tenant ON environments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_environments_created ON environments(created_at DESC);

