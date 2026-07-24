-- Pipeline-Engine module tables (auto-generated)

CREATE TABLE IF NOT EXISTS pipeline_runs (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    pipeline_id VARCHAR(255) NOT NULL,
    pipeline_version VARCHAR(255) NOT NULL,
    trigger_type VARCHAR(255) NOT NULL,
    trigger_by VARCHAR(255),
    status VARCHAR(255) NOT NULL,
    environment VARCHAR(255),
    started_at BIGINT,
    completed_at BIGINT,
    duration_ms BIGINT,
    context VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_tenant ON pipeline_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_created ON pipeline_runs(created_at DESC);

CREATE TABLE IF NOT EXISTS stages (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    run_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    sequence BIGINT NOT NULL,
    status VARCHAR(255) NOT NULL,
    depends_on VARCHAR(255) NOT NULL,
    condition VARCHAR(255),
    timeout_seconds BIGINT NOT NULL,
    retry_count BIGINT NOT NULL,
    max_retries BIGINT NOT NULL,
    started_at BIGINT,
    completed_at BIGINT,
    duration_ms BIGINT,
    result VARCHAR(255),
    error VARCHAR(255),
    targets VARCHAR(255) NOT NULL,
    execution_mode VARCHAR(255),
    batch_size BIGINT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_stages_tenant ON stages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stages_created ON stages(created_at DESC);

CREATE TABLE IF NOT EXISTS tasks (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    stage_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(255) NOT NULL,
    sequence BIGINT NOT NULL,
    status VARCHAR(255) NOT NULL,
    config VARCHAR(255) NOT NULL,
    parameters VARCHAR(255) NOT NULL,
    resource_quota VARCHAR(255),
    retry_count BIGINT NOT NULL,
    max_retries BIGINT NOT NULL,
    timeout_seconds BIGINT NOT NULL,
    started_at BIGINT,
    completed_at BIGINT,
    duration_ms BIGINT,
    result VARCHAR(255),
    log VARCHAR(255),
    error VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_tasks_tenant ON tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at DESC);

