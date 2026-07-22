-- Pipeline-Execution-Control module tables (auto-generated)

CREATE TABLE IF NOT EXISTS execution_control_logs (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    run_id VARCHAR(255) NOT NULL,
    action VARCHAR(255) NOT NULL,
    reason VARCHAR(255),
    operator VARCHAR(255),
    metadata VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_execution_control_logs_tenant ON execution_control_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_execution_control_logs_created ON execution_control_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS checkpoints (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    run_id VARCHAR(255) NOT NULL,
    stage_id VARCHAR(255) NOT NULL,
    stage_name VARCHAR(255) NOT NULL,
    data VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_tenant ON checkpoints(tenant_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_created ON checkpoints(created_at DESC);

CREATE TABLE IF NOT EXISTS runs (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    status VARCHAR(255) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_runs_tenant ON runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_runs_created ON runs(created_at DESC);

