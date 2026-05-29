CREATE TABLE IF NOT EXISTS cron_jobs (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	name VARCHAR(256) NOT NULL,
	schedule VARCHAR(128) NOT NULL,
	command TEXT NOT NULL,
	enabled BOOLEAN NOT NULL DEFAULT true,
	last_run_at TIMESTAMPTZ,
	next_run_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cron_jobs_tenant ON cron_jobs(tenant_id, enabled);
