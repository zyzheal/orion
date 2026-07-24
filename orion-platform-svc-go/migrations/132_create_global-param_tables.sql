-- Global-Param module tables (auto-generated)

CREATE TABLE IF NOT EXISTS global_params (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_global_params_tenant ON global_params(tenant_id);
CREATE INDEX IF NOT EXISTS idx_global_params_created ON global_params(created_at DESC);

