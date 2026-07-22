-- Dependency-Coordination module tables (auto-generated)

CREATE TABLE IF NOT EXISTS dependency_coordinations (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_dependency_coordinations_tenant ON dependency_coordinations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dependency_coordinations_created ON dependency_coordinations(created_at DESC);

