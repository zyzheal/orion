-- Migration 004: Autonomous pipeline and execution control tables

-- Error classification rules for autonomous pipeline
CREATE TABLE IF NOT EXISTS autonomous_error_classification (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id     UUID NOT NULL,
    pipeline_id   UUID REFERENCES pipelines(id) ON DELETE CASCADE,
    name          VARCHAR(255) NOT NULL,
    pattern       TEXT NOT NULL,
    category      VARCHAR(100) NOT NULL,
    action        VARCHAR(100) NOT NULL,
    priority      INT NOT NULL DEFAULT 1,
    enabled       BOOLEAN NOT NULL DEFAULT true,
    created_by    VARCHAR(255),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_err_class_tenant ON autonomous_error_classification(tenant_id);
CREATE INDEX idx_err_class_pipeline ON autonomous_error_classification(pipeline_id);

-- Adaptive timeout configuration
CREATE TABLE IF NOT EXISTS autonomous_adaptive_timeout (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id     UUID NOT NULL,
    pipeline_id   UUID REFERENCES pipelines(id) ON DELETE CASCADE,
    min_timeout   INT NOT NULL DEFAULT 60,
    max_timeout   INT NOT NULL DEFAULT 3600,
    strategy      VARCHAR(50) NOT NULL DEFAULT 'moving_avg',
    multiplier    DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    enabled       BOOLEAN NOT NULL DEFAULT true,
    created_by    VARCHAR(255),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_adaptive_timeout_pipeline ON autonomous_adaptive_timeout(tenant_id, pipeline_id);

-- Auto retry strategy
CREATE TABLE IF NOT EXISTS autonomous_auto_retry (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id     UUID NOT NULL,
    pipeline_id   UUID REFERENCES pipelines(id) ON DELETE CASCADE,
    max_retries   INT NOT NULL DEFAULT 3,
    backoff       VARCHAR(50) NOT NULL DEFAULT 'exponential',
    conditions    TEXT NOT NULL DEFAULT 'transient_failure',
    enabled       BOOLEAN NOT NULL DEFAULT true,
    created_by    VARCHAR(255),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_auto_retry_pipeline ON autonomous_auto_retry(tenant_id, pipeline_id);

-- Self-healing operations
CREATE TABLE IF NOT EXISTS autonomous_self_healing (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id     UUID NOT NULL,
    pipeline_id   UUID REFERENCES pipelines(id) ON DELETE CASCADE,
    run_id        UUID REFERENCES pipeline_runs(id) ON DELETE CASCADE,
    action        VARCHAR(100) NOT NULL,
    status        VARCHAR(30) NOT NULL DEFAULT 'running',
    message       TEXT,
    created_by    VARCHAR(255),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_self_healing_tenant ON autonomous_self_healing(tenant_id);
CREATE INDEX idx_self_healing_run ON autonomous_self_healing(run_id);

-- Pipeline run checkpoints
CREATE TABLE IF NOT EXISTS pipeline_run_checkpoints (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id        UUID NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
    stage_id      UUID REFERENCES stages(id) ON DELETE SET NULL,
    name          VARCHAR(255) NOT NULL,
    data          JSONB DEFAULT '{}',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_checkpoints_run ON pipeline_run_checkpoints(run_id);

-- Pipeline control action logs
CREATE TABLE IF NOT EXISTS pipeline_control_logs (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id        UUID NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
    action        VARCHAR(50) NOT NULL,
    user_id       VARCHAR(255) NOT NULL,
    message       TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_control_logs_run ON pipeline_control_logs(run_id);
CREATE INDEX idx_control_logs_created ON pipeline_control_logs(created_at);