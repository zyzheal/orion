-- Migration 001: Pipeline service tables

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Pipeline definitions
CREATE TABLE IF NOT EXISTS pipelines (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id     UUID NOT NULL,
    name          VARCHAR(255) NOT NULL,
    description   TEXT,
    version       VARCHAR(50) NOT NULL DEFAULT 'v1.0.0',
    config        TEXT NOT NULL,
    status        VARCHAR(30) NOT NULL DEFAULT 'active',
    created_by    VARCHAR(255),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pipelines_tenant ON pipelines(tenant_id);
CREATE INDEX idx_pipelines_status ON pipelines(status);

-- Pipeline runs
CREATE TABLE IF NOT EXISTS pipeline_runs (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pipeline_id      UUID NOT NULL REFERENCES pipelines(id),
    tenant_id        UUID NOT NULL,
    pipeline_version VARCHAR(50) NOT NULL,
    trigger_type     VARCHAR(30) NOT NULL DEFAULT 'manual',
    trigger_by       VARCHAR(255),
    environment      VARCHAR(100),
    status           VARCHAR(30) NOT NULL DEFAULT 'pending',
    started_at       TIMESTAMPTZ,
    completed_at     TIMESTAMPTZ,
    duration_ms      BIGINT DEFAULT 0,
    context          JSONB DEFAULT '{}',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pipeline_runs_pipeline ON pipeline_runs(pipeline_id);
CREATE INDEX idx_pipeline_runs_tenant ON pipeline_runs(tenant_id);
CREATE INDEX idx_pipeline_runs_status ON pipeline_runs(status);

-- Stages within a run
CREATE TABLE IF NOT EXISTS stages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id          UUID NOT NULL REFERENCES pipeline_runs(id),
    name            VARCHAR(255) NOT NULL,
    sequence        INT NOT NULL DEFAULT 0,
    status          VARCHAR(30) NOT NULL DEFAULT 'pending',
    depends_on      JSONB DEFAULT '[]',
    timeout_seconds INT DEFAULT 3600,
    retry_count     INT DEFAULT 0,
    max_retries     INT DEFAULT 0,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stages_run ON stages(run_id);

-- Tasks within a stage
CREATE TABLE IF NOT EXISTS tasks (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stage_id      UUID NOT NULL REFERENCES stages(id),
    name          VARCHAR(255) NOT NULL,
    type          VARCHAR(50) NOT NULL,
    status        VARCHAR(30) NOT NULL DEFAULT 'pending',
    config        JSONB DEFAULT '{}',
    sequence      INT NOT NULL DEFAULT 0,
    started_at    TIMESTAMPTZ,
    completed_at  TIMESTAMPTZ,
    exit_code     INT DEFAULT 0,
    logs          TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_stage ON tasks(stage_id);
