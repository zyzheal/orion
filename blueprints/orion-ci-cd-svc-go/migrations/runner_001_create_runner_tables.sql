-- Runners: remote execution agents that process pipeline tasks
CREATE TABLE IF NOT EXISTS runners (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    type VARCHAR(32) NOT NULL DEFAULT 'docker',
    status VARCHAR(32) NOT NULL DEFAULT 'idle',
    endpoint TEXT,
    capacity INT NOT NULL DEFAULT 1,
    max_concurrent INT NOT NULL DEFAULT 1,
    current_jobs INT NOT NULL DEFAULT 0,
    labels JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    last_heartbeat TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_runners_tenant ON runners(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_runners_status ON runners(status);
CREATE INDEX IF NOT EXISTS idx_runners_heartbeat ON runners(last_heartbeat);

-- Pipeline runs: tracks execution of a pipeline
CREATE TABLE IF NOT EXISTS pipeline_runs (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    pipeline_id VARCHAR(128) NOT NULL,
    trigger_type VARCHAR(32) NOT NULL DEFAULT 'manual',
    trigger_by VARCHAR(128),
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    environment_name VARCHAR(128),
    config_snapshot JSONB DEFAULT '{}',
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_tenant ON pipeline_runs(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_pipeline ON pipeline_runs(pipeline_id, created_at);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status ON pipeline_runs(status);

-- Stage executions: tracks execution of pipeline stages within a run
CREATE TABLE IF NOT EXISTS stage_executions (
    id UUID PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
    stage_id VARCHAR(128),
    stage_name VARCHAR(256) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    error_message TEXT,
    logs TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stage_executions_run ON stage_executions(run_id, created_at);

-- Task executions: tracks execution of individual tasks within a stage
CREATE TABLE IF NOT EXISTS task_executions (
    id UUID PRIMARY KEY,
    execution_id UUID NOT NULL REFERENCES stage_executions(id) ON DELETE CASCADE,
    task_name VARCHAR(256) NOT NULL,
    task_type VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    input JSONB DEFAULT '{}',
    output JSONB,
    error_message TEXT,
    logs TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_task_executions_stage ON task_executions(execution_id, created_at);

-- Runner jobs: tracks task dispatch to remote runners
CREATE TABLE IF NOT EXISTS runner_jobs (
    id UUID PRIMARY KEY,
    runner_id UUID NOT NULL REFERENCES runners(id) ON DELETE CASCADE,
    task_id VARCHAR(128) NOT NULL,
    stage_id VARCHAR(128),
    run_id VARCHAR(128),
    tenant_id VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    result JSONB,
    error TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_runner_jobs_runner ON runner_jobs(runner_id, created_at);
CREATE INDEX IF NOT EXISTS idx_runner_jobs_status ON runner_jobs(status);
CREATE INDEX IF NOT EXISTS idx_runner_jobs_task ON runner_jobs(task_id);
