-- Pipeline-Batch module tables (auto-generated)

CREATE TABLE IF NOT EXISTS phase_groups (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    pipeline_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    batch_strategy VARCHAR(255) NOT NULL,
    batch_config VARCHAR(255) NOT NULL,
    gate_type VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_phase_groups_tenant ON phase_groups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_phase_groups_created ON phase_groups(created_at DESC);

CREATE TABLE IF NOT EXISTS batch_runs (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    phase_group_id VARCHAR(255) NOT NULL,
    batch_index BIGINT NOT NULL,
    status VARCHAR(255) NOT NULL,
    result VARCHAR(255) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_batch_runs_tenant ON batch_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_batch_runs_created ON batch_runs(created_at DESC);

