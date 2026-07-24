-- Pipeline-Budget module tables (auto-generated)

CREATE TABLE IF NOT EXISTS budget_configs (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    pipeline_id VARCHAR(255) NOT NULL,
    type VARCHAR(255) NOT NULL,
    period VARCHAR(255) NOT NULL,
    limits VARCHAR(255) NOT NULL,
    cost_limits VARCHAR(255),
    alerts VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_budget_configs_tenant ON budget_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_budget_configs_created ON budget_configs(created_at DESC);

CREATE TABLE IF NOT EXISTS budget_history_records (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    pipeline_id VARCHAR(255) NOT NULL,
    timestamp BIGINT,
    action VARCHAR(255) NOT NULL,
    details VARCHAR(255) NOT NULL,
    actor VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_budget_history_records_tenant ON budget_history_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_budget_history_records_created ON budget_history_records(created_at DESC);

