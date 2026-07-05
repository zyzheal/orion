-- Plugins table
CREATE TABLE IF NOT EXISTS plugins (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    description TEXT,
    version VARCHAR(64) NOT NULL DEFAULT '0.1.0',
    author VARCHAR(128),
    enabled BOOLEAN NOT NULL DEFAULT true,
    config JSONB DEFAULT '{}',
    entrypoint TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_plugins_tenant ON plugins(tenant_id, created_at);

-- Plugin executions table
CREATE TABLE IF NOT EXISTS plugin_executions (
    id UUID PRIMARY KEY,
    plugin_id UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL,
    task_id VARCHAR(128) NOT NULL,
    pipeline_run_id VARCHAR(128),
    stage_id VARCHAR(128),
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    exit_code INTEGER,
    stdout TEXT,
    stderr TEXT,
    duration_ms INTEGER,
    error_message TEXT,
    killed BOOLEAN NOT NULL DEFAULT false,
    kill_reason VARCHAR(64),
    resource_usage JSONB,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_plugin_executions_plugin ON plugin_executions(plugin_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_plugin_executions_tenant ON plugin_executions(tenant_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_plugin_executions_task ON plugin_executions(task_id);

-- Plugin audit entries table
CREATE TABLE IF NOT EXISTS plugin_audit_entries (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64),
    plugin_id UUID,
    task_id VARCHAR(128),
    level VARCHAR(16) NOT NULL DEFAULT 'INFO',
    action VARCHAR(64) NOT NULL,
    message TEXT,
    input JSONB,
    output JSONB,
    duration_ms INTEGER,
    metadata JSONB DEFAULT '{}',
    entry_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_entries_plugin ON plugin_audit_entries(plugin_id, entry_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entries_task ON plugin_audit_entries(task_id, entry_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entries_tenant ON plugin_audit_entries(tenant_id, entry_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entries_level ON plugin_audit_entries(level, entry_at DESC);

-- Plugin security events table
CREATE TABLE IF NOT EXISTS plugin_security_events (
    id UUID PRIMARY KEY,
    event_type VARCHAR(64) NOT NULL,
    severity VARCHAR(16) NOT NULL DEFAULT 'MEDIUM',
    task_id VARCHAR(128),
    plugin_id UUID,
    tenant_id VARCHAR(64),
    message TEXT,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_security_events_plugin ON plugin_security_events(plugin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_tenant ON plugin_security_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON plugin_security_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON plugin_security_events(severity, created_at DESC);

-- Plugin resource quotas table
CREATE TABLE IF NOT EXISTS plugin_resource_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plugin_id UUID NOT NULL,
    tenant_id VARCHAR(64),
    cpu_cores INTEGER NOT NULL DEFAULT 2,
    memory_bytes BIGINT NOT NULL DEFAULT 2147483648,
    timeout_ms INTEGER NOT NULL DEFAULT 60000,
    max_concurrent INTEGER NOT NULL DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(plugin_id)
);
CREATE INDEX IF NOT EXISTS idx_resource_quotas_plugin ON plugin_resource_quotas(plugin_id);

-- Plugin tenant quotas table
CREATE TABLE IF NOT EXISTS plugin_tenant_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL UNIQUE,
    cpu_cores INTEGER NOT NULL DEFAULT 2,
    memory_bytes BIGINT NOT NULL DEFAULT 4294967296,
    timeout_ms INTEGER NOT NULL DEFAULT 120000,
    max_concurrent INTEGER NOT NULL DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tenant_quotas_tenant ON plugin_tenant_quotas(tenant_id);
