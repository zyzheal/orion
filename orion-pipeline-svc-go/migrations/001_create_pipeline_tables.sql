CREATE TABLE IF NOT EXISTS pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    repo_id UUID,
    branch VARCHAR(255),
    trigger_type VARCHAR(50),
    cron_expression VARCHAR(100),
    yaml_config TEXT,
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pipeline_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID REFERENCES pipelines(id),
    trigger_type VARCHAR(50),
    trigger_by VARCHAR(255),
    status VARCHAR(50),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    context JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pipeline_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES pipeline_runs(id),
    name VARCHAR(255),
    status VARCHAR(50),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    logs TEXT
);

CREATE INDEX idx_pipelines_tenant_id ON pipelines (tenant_id);
CREATE INDEX idx_pipeline_runs_pipeline_id ON pipeline_runs (pipeline_id);
CREATE INDEX idx_pipeline_stages_run_id ON pipeline_stages (run_id);
