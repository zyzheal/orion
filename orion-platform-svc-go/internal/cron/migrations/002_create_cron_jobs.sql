-- SchedulerManager: scheduler_job_definitions
CREATE TABLE IF NOT EXISTS scheduler_job_definitions (
    id UUID PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    cron_expr TEXT NOT NULL,
    job_type TEXT NOT NULL,
    config JSONB,
    status TEXT DEFAULT 'enabled',
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    max_retries INTEGER DEFAULT 3,
    timeout_sec INTEGER DEFAULT 300,
    enabled BOOLEAN DEFAULT TRUE,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scheduler_job_defs_tenant ON scheduler_job_definitions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scheduler_job_defs_enabled ON scheduler_job_definitions(enabled);
CREATE INDEX IF NOT EXISTS idx_scheduler_job_defs_status ON scheduler_job_definitions(status);

-- SchedulerManager: scheduler_job_execution_logs
CREATE TABLE IF NOT EXISTS scheduler_job_execution_logs (
    id UUID PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES scheduler_job_definitions(id),
    status TEXT NOT NULL,
    output TEXT,
    error TEXT,
    duration_ms BIGINT,
    started_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_scheduler_job_exec_logs_job ON scheduler_job_execution_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_scheduler_job_exec_logs_started ON scheduler_job_execution_logs(started_at);
