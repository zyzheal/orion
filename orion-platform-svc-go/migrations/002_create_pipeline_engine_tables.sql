-- Pipeline Engine Tables (Phase 3.1)
-- Migration 002 for orion-platform-svc-go

CREATE TABLE IF NOT EXISTS pipeline_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id VARCHAR(255) NOT NULL,
    pipeline_version VARCHAR(50) NOT NULL,
    trigger_type VARCHAR(50) NOT NULL,
    trigger_by VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    environment VARCHAR(255),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms BIGINT,
    context JSONB DEFAULT '{}',
    tenant_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pipeline_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES pipeline_runs(id),
    name VARCHAR(255) NOT NULL,
    sequence INT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    depends_on JSONB DEFAULT '[]',
    condition TEXT,
    timeout_seconds INT DEFAULT 3600,
    retry_count INT DEFAULT 0,
    max_retries INT DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms BIGINT,
    result JSONB,
    error TEXT,
    targets JSONB DEFAULT '[]',
    execution_mode VARCHAR(50),
    batch_size INT DEFAULT 1,
    tenant_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pipeline_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_id UUID NOT NULL REFERENCES pipeline_stages(id),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(255) NOT NULL,
    sequence INT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    config JSONB DEFAULT '{}',
    parameters JSONB DEFAULT '{}',
    resource_quota JSONB,
    retry_count INT DEFAULT 0,
    max_retries INT DEFAULT 0,
    timeout_seconds INT DEFAULT 3600,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms BIGINT,
    result JSONB,
    log TEXT,
    error TEXT,
    tenant_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pipeline_checkpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES pipeline_runs(id),
    stage_name VARCHAR(255) NOT NULL,
    task_name VARCHAR(255),
    state JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_pipeline_id ON pipeline_runs(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status ON pipeline_runs(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_tenant_id ON pipeline_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_run_id ON pipeline_stages(run_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_tasks_stage_id ON pipeline_tasks(stage_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_checkpoints_run_id ON pipeline_checkpoints(run_id);
