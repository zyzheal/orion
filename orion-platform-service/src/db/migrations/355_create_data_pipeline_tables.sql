-- Migration: 355_create_data_pipeline_tables.sql
-- Purpose: Persist data pipeline module (pipelines, executions, stage_results)

-- Data Pipelines
CREATE TABLE IF NOT EXISTS data_pipelines (
    id              VARCHAR(50) PRIMARY KEY,
    tenant_id       VARCHAR(50) NOT NULL,
    name            VARCHAR(200) NOT NULL,
    description     TEXT DEFAULT '',
    stages          JSONB NOT NULL DEFAULT '[]',
    status          VARCHAR(20) DEFAULT 'draft',  -- draft, scheduled, running, completed, failed, paused
    schedule        VARCHAR(100),                  -- cron expression
    last_run_at     TIMESTAMPTZ,
    next_run_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dp_tenant ON data_pipelines(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dp_status ON data_pipelines(status);
CREATE INDEX IF NOT EXISTS idx_dp_created ON data_pipelines(created_at DESC);

-- Pipeline Executions
CREATE TABLE IF NOT EXISTS pipeline_executions (
    id              VARCHAR(50) PRIMARY KEY,
    pipeline_id     VARCHAR(50) NOT NULL REFERENCES data_pipelines(id),
    tenant_id       VARCHAR(50) NOT NULL,
    status          VARCHAR(20) DEFAULT 'pending',  -- pending, running, completed, failed
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pe_pipeline ON pipeline_executions(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pe_tenant ON pipeline_executions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pe_status ON pipeline_executions(status);
CREATE INDEX IF NOT EXISTS idx_pe_started ON pipeline_executions(started_at DESC);

-- Stage Results (per execution)
CREATE TABLE IF NOT EXISTS stage_results (
    id              SERIAL PRIMARY KEY,
    execution_id    VARCHAR(50) NOT NULL REFERENCES pipeline_executions(id) ON DELETE CASCADE,
    pipeline_id     VARCHAR(50) NOT NULL,
    tenant_id       VARCHAR(50) NOT NULL,
    stage_id        VARCHAR(50) NOT NULL,
    stage_name      VARCHAR(200) NOT NULL,
    status          VARCHAR(20) DEFAULT 'pending',  -- pending, running, completed, failed
    records_processed INTEGER DEFAULT 0,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    error           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sr_execution ON stage_results(execution_id);
CREATE INDEX IF NOT EXISTS idx_sr_pipeline ON stage_results(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_sr_tenant ON stage_results(tenant_id);
