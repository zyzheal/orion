-- Chaos-Enhanced module tables (auto-generated)

CREATE TABLE IF NOT EXISTS experiments (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(255) NOT NULL,
    environment_id VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    fault_spec VARCHAR(255) NOT NULL,
    target_id VARCHAR(255) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    recovery_info VARCHAR(255),
    created_by VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_experiments_tenant ON experiments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_experiments_created ON experiments(created_at DESC);

CREATE TABLE IF NOT EXISTS fault_injections (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    experiment_id VARCHAR(255) NOT NULL,
    fault_type VARCHAR(255) NOT NULL,
    fault_config VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    injected_at TIMESTAMP WITH TIME ZONE NOT NULL,
    result VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_fault_injections_tenant ON fault_injections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fault_injections_created ON fault_injections(created_at DESC);

