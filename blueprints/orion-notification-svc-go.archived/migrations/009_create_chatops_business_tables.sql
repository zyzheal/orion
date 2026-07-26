-- Commands registry
CREATE TABLE IF NOT EXISTS chatops_commands (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    subcommand VARCHAR(128) NOT NULL DEFAULT '',
    schema_def JSONB NOT NULL DEFAULT '{}',
    aliases JSONB NOT NULL DEFAULT '[]',
    permission_level VARCHAR(32) NOT NULL DEFAULT 'user',
    examples JSONB NOT NULL DEFAULT '[]',
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);
CREATE INDEX idx_chatops_commands_tenant ON chatops_commands(tenant_id, name);

-- Command executions
CREATE TABLE IF NOT EXISTS chatops_executions (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    command_id VARCHAR(128) NOT NULL,
    user_id VARCHAR(128) NOT NULL,
    platform VARCHAR(32) NOT NULL DEFAULT 'slack',
    channel VARCHAR(128) NOT NULL DEFAULT '',
    params JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(32) NOT NULL DEFAULT 'running',
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    result JSONB NOT NULL DEFAULT '{}',
    milestones JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_chatops_executions_tenant ON chatops_executions(tenant_id, created_at DESC);
CREATE INDEX idx_chatops_executions_user ON chatops_executions(tenant_id, user_id);
CREATE INDEX idx_chatops_executions_status ON chatops_executions(tenant_id, status);

-- Chat sessions (conversation history)
CREATE TABLE IF NOT EXISTS chatops_sessions (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    session_key VARCHAR(256) NOT NULL,
    user_id VARCHAR(128) NOT NULL,
    channel_id VARCHAR(128) NOT NULL DEFAULT '',
    history JSONB NOT NULL DEFAULT '[]',
    state JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, session_key)
);
CREATE INDEX idx_chatops_sessions_key ON chatops_sessions(tenant_id, session_key);

-- Audit logs
CREATE TABLE IF NOT EXISTS chatops_audit_logs (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    trace_id VARCHAR(128) NOT NULL,
    actor JSONB NOT NULL DEFAULT '{}',
    action JSONB NOT NULL DEFAULT '{}',
    result VARCHAR(32) NOT NULL DEFAULT 'success',
    context JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_chatops_audit_tenant ON chatops_audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_chatops_audit_trace ON chatops_audit_logs(tenant_id, trace_id);

-- Webhooks
CREATE TABLE IF NOT EXISTS chatops_webhooks (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    url TEXT NOT NULL,
    events JSONB NOT NULL DEFAULT '[]',
    secret_key VARCHAR(256),
    enabled BOOLEAN NOT NULL DEFAULT true,
    retry_count INT NOT NULL DEFAULT 3,
    retry_interval_seconds INT NOT NULL DEFAULT 30,
    timeout_seconds INT NOT NULL DEFAULT 10,
    headers JSONB NOT NULL DEFAULT '{}',
    description TEXT NOT NULL DEFAULT '',
    created_by VARCHAR(128) NOT NULL DEFAULT 'system',
    last_triggered_at TIMESTAMPTZ,
    last_status VARCHAR(32),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_chatops_webhooks_tenant ON chatops_webhooks(tenant_id, created_at DESC);

-- Webhook delivery logs
CREATE TABLE IF NOT EXISTS chatops_webhook_logs (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    webhook_id UUID NOT NULL REFERENCES chatops_webhooks(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    response_status INT,
    response_body TEXT,
    error_message TEXT,
    retry_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_chatops_webhook_logs_wh ON chatops_webhook_logs(webhook_id, created_at DESC);

-- Rate limits
CREATE TABLE IF NOT EXISTS chatops_rate_limits (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    target_type VARCHAR(32) NOT NULL,
    target_id VARCHAR(128),
    command_name VARCHAR(128),
    limit_type VARCHAR(16) NOT NULL,
    limit_count INT NOT NULL,
    window_seconds INT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_chatops_rate_limits_tenant ON chatops_rate_limits(tenant_id, target_type);

-- Question configs (user quick-question cards)
CREATE TABLE IF NOT EXISTS chatops_question_configs (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(128) NOT NULL,
    key VARCHAR(64) NOT NULL,
    icon VARCHAR(64) NOT NULL DEFAULT '',
    title VARCHAR(256) NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    question TEXT NOT NULL DEFAULT '',
    enabled BOOLEAN NOT NULL DEFAULT true,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, user_id, key)
);

-- Command configs (user quick-command shortcuts)
CREATE TABLE IF NOT EXISTS chatops_command_configs (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(128) NOT NULL,
    key VARCHAR(64) NOT NULL,
    label VARCHAR(256) NOT NULL DEFAULT '',
    command TEXT NOT NULL DEFAULT '',
    enabled BOOLEAN NOT NULL DEFAULT true,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, user_id, key)
);
