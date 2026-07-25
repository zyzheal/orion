-- job_sources: job trigger sources (manual, schedule, webhook, api, event_trigger, cron, alert_callback, pipeline_step, approval_step, chat_command)
CREATE TABLE IF NOT EXISTS job_sources (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    config TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_job_sources_tenant ON job_sources(tenant_id);
CREATE INDEX IF NOT EXISTS idx_job_sources_type ON job_sources(type);
CREATE INDEX IF NOT EXISTS idx_job_sources_enabled ON job_sources(enabled);
CREATE INDEX IF NOT EXISTS idx_job_sources_status ON job_sources(status);

-- job_source_events: events received from job sources
CREATE TABLE IF NOT EXISTS job_source_events (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    source_id TEXT NOT NULL REFERENCES job_sources(id),
    payload TEXT,
    status TEXT DEFAULT 'received',
    job_id TEXT,
    error TEXT,
    received_at TIMESTAMPTZ NOT NULL,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_job_source_events_tenant ON job_source_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_job_source_events_source ON job_source_events(source_id);
CREATE INDEX IF NOT EXISTS idx_job_source_events_status ON job_source_events(status);
CREATE INDEX IF NOT EXISTS idx_job_source_events_received ON job_source_events(received_at);
