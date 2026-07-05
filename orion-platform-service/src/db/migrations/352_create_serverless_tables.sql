-- Migration: 352_create_serverless_tables.sql
-- Purpose: Persist serverless module (functions, triggers, deployments, logs, metrics)

-- Serverless Functions
CREATE TABLE IF NOT EXISTS serverless_functions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    name            VARCHAR(200) NOT NULL,
    description     TEXT DEFAULT '',
    runtime         VARCHAR(20) NOT NULL,          -- nodejs18, nodejs20, python3.9, python3.11, go1.21, java17
    handler         VARCHAR(200) NOT NULL,
    memory          INTEGER NOT NULL DEFAULT 256,  -- MB
    timeout         INTEGER NOT NULL DEFAULT 30,   -- seconds
    status          VARCHAR(20) DEFAULT 'draft',   -- draft, deployed, stopped, error
    version         INTEGER NOT NULL DEFAULT 1,
    environment     JSONB DEFAULT '{}',
    code            TEXT DEFAULT '',
    trigger_ids     JSONB DEFAULT '[]',
    endpoint        VARCHAR(500),
    replicas_min    INTEGER NOT NULL DEFAULT 0,
    replicas_max    INTEGER NOT NULL DEFAULT 10,
    replicas_current INTEGER NOT NULL DEFAULT 0,
    last_deployed_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_serverless_fn_tenant ON serverless_functions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_serverless_fn_status ON serverless_functions(status);
CREATE INDEX IF NOT EXISTS idx_serverless_fn_runtime ON serverless_functions(runtime);

-- Serverless Triggers
CREATE TABLE IF NOT EXISTS serverless_triggers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    function_id     UUID NOT NULL REFERENCES serverless_functions(id),
    type            VARCHAR(20) NOT NULL,          -- http, cron, event, queue, kafka, s3
    name            VARCHAR(200) NOT NULL,
    config          JSONB DEFAULT '{}',
    enabled         BOOLEAN DEFAULT TRUE,
    invocation_count INTEGER DEFAULT 0,
    last_invoked_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_serverless_trigger_tenant ON serverless_triggers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_serverless_trigger_fn ON serverless_triggers(function_id);
CREATE INDEX IF NOT EXISTS idx_serverless_trigger_type ON serverless_triggers(type);

-- Serverless Deployments
CREATE TABLE IF NOT EXISTS serverless_deployments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    function_id     UUID NOT NULL REFERENCES serverless_functions(id),
    version         INTEGER NOT NULL,
    status          VARCHAR(20) DEFAULT 'pending',  -- pending, deploying, success, failed, rolled_back
    code_version    VARCHAR(50),
    deployed_by     VARCHAR(100) DEFAULT 'system',
    error           TEXT,
    rollback_to     INTEGER,
    started_at      TIMESTAMPTZ NOT NULL,
    completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_serverless_dep_fn ON serverless_deployments(function_id);
CREATE INDEX IF NOT EXISTS idx_serverless_dep_tenant ON serverless_deployments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_serverless_dep_status ON serverless_deployments(status);

-- Serverless Logs
CREATE TABLE IF NOT EXISTS serverless_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    function_id     UUID NOT NULL,
    deployment_id   VARCHAR(100) DEFAULT '',
    level           VARCHAR(10) NOT NULL DEFAULT 'info',  -- info, warn, error, debug
    message         TEXT NOT NULL,
    request_id      VARCHAR(100),
    metadata        JSONB,
    timestamp       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_serverless_log_fn ON serverless_logs(function_id);
CREATE INDEX IF NOT EXISTS idx_serverless_log_tenant ON serverless_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_serverless_log_ts ON serverless_logs(timestamp DESC);

-- Serverless Metrics
CREATE TABLE IF NOT EXISTS serverless_metrics (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    function_id     UUID NOT NULL,
    tenant_id       UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    period          TIMESTAMPTZ NOT NULL,
    invocations     INTEGER DEFAULT 0,
    errors          INTEGER DEFAULT 0,
    avg_duration    NUMERIC DEFAULT 0,            -- ms
    p95_duration    NUMERIC DEFAULT 0,
    p99_duration    NUMERIC DEFAULT 0,
    avg_memory_used NUMERIC DEFAULT 0,            -- MB
    throttled_requests INTEGER DEFAULT 0,
    active_connections INTEGER DEFAULT 0,
    cpu_utilization NUMERIC DEFAULT 0             -- percentage
);

CREATE INDEX IF NOT EXISTS idx_serverless_metric_fn ON serverless_metrics(function_id);
CREATE INDEX IF NOT EXISTS idx_serverless_metric_tenant ON serverless_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_serverless_metric_period ON serverless_metrics(period DESC);
