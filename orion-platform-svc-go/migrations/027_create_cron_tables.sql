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
-- 补齐 cron_jobs：078_create_visor_exec_tables.sql 的定义晚于 027_create_cron_tables.sql，按序执行时表已存在
ALTER TABLE cron_jobs ADD COLUMN IF NOT EXISTS command TEXT NOT NULL, ADD COLUMN IF NOT EXISTS host_ids TEXT, ADD COLUMN IF NOT EXISTS hostnames TEXT, ADD COLUMN IF NOT EXISTS cron_expression VARCHAR(255) NOT NULL, ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMP WITH TIME ZONE, ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMP WITH TIME ZONE;


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
