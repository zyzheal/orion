-- Chatops module tables

CREATE TABLE IF NOT EXISTS chatops_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    subcommand VARCHAR(255),
    aliases JSONB,
    description TEXT,
    permission_level VARCHAR(50),
    schema JSONB,
    examples JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chatops_commands_tenant_id ON chatops_commands(tenant_id);

CREATE TABLE IF NOT EXISTS chatops_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    command_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'running',
    params JSONB,
    result JSONB,
    milestones JSONB,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chatops_executions_tenant_id ON chatops_executions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chatops_executions_command_id ON chatops_executions(command_id);
CREATE INDEX IF NOT EXISTS idx_chatops_executions_user_id ON chatops_executions(user_id);

CREATE TABLE IF NOT EXISTS chatops_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chatops_sessions_tenant_id ON chatops_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chatops_sessions_user_id ON chatops_sessions(user_id);

CREATE TABLE IF NOT EXISTS chatops_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    text TEXT,
    platform VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chatops_messages_tenant_id ON chatops_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chatops_messages_session_id ON chatops_messages(session_id);

CREATE TABLE IF NOT EXISTS chatops_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,
    command VARCHAR(255),
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chatops_audit_logs_tenant_id ON chatops_audit_logs(tenant_id);

CREATE TABLE IF NOT EXISTS chatops_notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    alert_level VARCHAR(50),
    channel_chatops BOOLEAN DEFAULT FALSE,
    channel_email BOOLEAN DEFAULT FALSE,
    channel_slack BOOLEAN DEFAULT FALSE,
    channel_feishu BOOLEAN DEFAULT FALSE,
    channel_dingtalk BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE(tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chatops_notification_preferences_tenant_id ON chatops_notification_preferences(tenant_id);

CREATE TABLE IF NOT EXISTS chatops_dnd_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    enabled BOOLEAN DEFAULT FALSE,
    start_time VARCHAR(50),
    end_time VARCHAR(50),
    repeat_days VARCHAR(255),
    allow_critical BOOLEAN DEFAULT FALSE,
    UNIQUE(tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS chatops_platform_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id VARCHAR(255),
    platform VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    webhook VARCHAR(255),
    token VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS chatops_alert_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    alert_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'unread',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS chatops_question_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id VARCHAR(255),
    title VARCHAR(255),
    command VARCHAR(255),
    enabled BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS chatops_command_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id VARCHAR(255),
    command VARCHAR(255),
    params JSONB,
    enabled BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS chatops_capability_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    command_id VARCHAR(255) NOT NULL,
    capability_id VARCHAR(255) NOT NULL,
    environment VARCHAR(50),
    risk_level BIGINT NOT NULL,
    requires_approval BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS chatops_approval_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    capability VARCHAR(255) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    approvers JSONB,
    threshold BIGINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS chatops_permission_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    permissions JSONB
);

CREATE TABLE IF NOT EXISTS chatops_command_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    command VARCHAR(255) NOT NULL,
    description TEXT,
    capability VARCHAR(255),
    risk_level BIGINT DEFAULT 0,
    requires_approval BOOLEAN DEFAULT FALSE,
    role_ids JSONB
);

CREATE TABLE IF NOT EXISTS chatops_environment_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    environment VARCHAR(255) NOT NULL,
    description TEXT,
    rate_limit BIGINT DEFAULT 0,
    require_approval BOOLEAN DEFAULT FALSE,
    allowed_commands JSONB,
    denied_commands JSONB,
    role_ids JSONB
);

CREATE TABLE IF NOT EXISTS chatops_command_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    command_id VARCHAR(255) NOT NULL,
    command_text TEXT,
    parameters JSONB,
    description TEXT,
    changelog TEXT,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS chatops_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id VARCHAR(255),
    command_name VARCHAR(255),
    limit_type VARCHAR(50) NOT NULL,
    limit_count BIGINT NOT NULL,
    window_seconds BIGINT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS chatops_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(255) NOT NULL,
    events JSONB,
    secret_key VARCHAR(255),
    enabled BOOLEAN DEFAULT TRUE,
    retry_count BIGINT DEFAULT 0,
    timeout_seconds BIGINT DEFAULT 0,
    headers JSONB,
    description TEXT,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
