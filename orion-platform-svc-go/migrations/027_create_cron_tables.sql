CREATE TABLE IF NOT EXISTS cron_jobs (
    id UUID PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    schedule TEXT,
    task TEXT,
    description TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS cron_job_executions (
    execution_id UUID PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES cron_jobs(id),
    tenant_id TEXT NOT NULL,
    status TEXT NOT NULL,
    output TEXT,
    started_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cron_jobs_tenant ON cron_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cron_executions_tenant ON cron_job_executions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cron_executions_job ON cron_job_executions(job_id);
