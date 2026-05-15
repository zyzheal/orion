-- ChatOps Service Database Schema Initialization
-- Version: 001
-- Created: 2026-05-15
-- Description: Initial database schema for ChatOps service

-- ============================================
-- ChatOps Core Tables (Main Domain)
-- ============================================

-- ChatOps Commands
CREATE TABLE IF NOT EXISTS chatops_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    subcommand VARCHAR(255) DEFAULT '',
    schema JSONB DEFAULT '{}',
    aliases TEXT[] DEFAULT '{}',
    permission_level VARCHAR(50) DEFAULT 'user',
    examples TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chatops_commands_name ON chatops_commands(name);
CREATE INDEX IF NOT EXISTS idx_chatops_commands_permission ON chatops_commands(permission_level);

-- ChatOps Executions
CREATE TABLE IF NOT EXISTS chatops_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    command_id UUID REFERENCES chatops_commands(id) ON DELETE SET NULL,
    user_id VARCHAR(255) NOT NULL,
    platform VARCHAR(50) NOT NULL,
    channel VARCHAR(255) DEFAULT 'chatops',
    params JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'pending',
    start_time TIMESTAMPTZ DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    result JSONB DEFAULT '{}',
    milestones JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chatops_executions_user ON chatops_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_chatops_executions_status ON chatops_executions(status);
CREATE INDEX IF NOT EXISTS idx_chatops_executions_command ON chatops_executions(command_id);
CREATE INDEX IF NOT EXISTS idx_chatops_executions_start_time ON chatops_executions(start_time);

-- ChatOps Sessions
CREATE TABLE IF NOT EXISTS chatops_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(255) NOT NULL UNIQUE,
    user_id VARCHAR(255) NOT NULL,
    channel_id VARCHAR(255),
    history JSONB DEFAULT '[]',
    state JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chatops_sessions_key ON chatops_sessions(key);
CREATE INDEX IF NOT EXISTS idx_chatops_sessions_user ON chatops_sessions(user_id);

-- ChatOps Audit Logs
CREATE TABLE IF NOT EXISTS chatops_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trace_id VARCHAR(255) NOT NULL,
    actor JSONB NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    action JSONB NOT NULL,
    result VARCHAR(50) DEFAULT 'unknown',
    context JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_chatops_audit_logs_trace ON chatops_audit_logs(trace_id);
CREATE INDEX IF NOT EXISTS idx_chatops_audit_logs_result ON chatops_audit_logs(result);
CREATE INDEX IF NOT EXISTS idx_chatops_audit_logs_timestamp ON chatops_audit_logs(timestamp);

-- ChatOps Messages
CREATE TABLE IF NOT EXISTS chatops_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_key VARCHAR(255) REFERENCES chatops_sessions(key) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    parsed_command JSONB,
    parsed_command_sanitized BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chatops_messages_session ON chatops_messages(session_key);
CREATE INDEX IF NOT EXISTS idx_chatops_messages_created ON chatops_messages(created_at);

-- ChatOps Notification Preferences
CREATE TABLE IF NOT EXISTS chatops_notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    alert_level VARCHAR(20) NOT NULL CHECK (alert_level IN ('critical', 'warning', 'info')),
    channel_chatops BOOLEAN DEFAULT true,
    channel_email BOOLEAN DEFAULT false,
    channel_slack BOOLEAN DEFAULT false,
    channel_feishu BOOLEAN DEFAULT false,
    channel_dingtalk BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, alert_level)
);

CREATE INDEX IF NOT EXISTS idx_chatops_notif_pref_user ON chatops_notification_preferences(user_id);

-- ChatOps DND Settings
CREATE TABLE IF NOT EXISTS chatops_dnd_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL UNIQUE,
    enabled BOOLEAN DEFAULT false,
    start_time VARCHAR(5) DEFAULT '22:00',
    end_time VARCHAR(5) DEFAULT '08:00',
    repeat_days INTEGER[] DEFAULT '{1,2,3,4,5}',
    allow_critical BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chatops_dnd_settings_user ON chatops_dnd_settings(user_id);

-- ChatOps Alert States
CREATE TABLE IF NOT EXISTS chatops_alert_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    alert_id VARCHAR(255) NOT NULL,
    state VARCHAR(20) NOT NULL CHECK (state IN ('unread', 'read', 'acknowledged', 'dismissed')),
    read_at TIMESTAMPTZ,
    dismissed_at TIMESTAMPTZ,
    escalation_stopped BOOLEAN DEFAULT false,
    escalation_current_level INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, alert_id)
);

CREATE INDEX IF NOT EXISTS idx_chatops_alert_states_user ON chatops_alert_states(user_id);
CREATE INDEX IF NOT EXISTS idx_chatops_alert_states_state ON chatops_alert_states(state);

-- ChatOps Platform Configs
CREATE TABLE IF NOT EXISTS chatops_platform_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('dingtalk', 'wecom', 'feishu', 'slack')),
    enabled BOOLEAN DEFAULT true,
    webhook VARCHAR(1024),
    token VARCHAR(512),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_chatops_platform_configs_user ON chatops_platform_configs(user_id);

-- ============================================
-- Deployment Tables
-- ============================================

CREATE TABLE IF NOT EXISTS deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    environment VARCHAR(255) NOT NULL,
    config JSONB DEFAULT '{}',
    strategy VARCHAR(50) DEFAULT 'rolling',
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deployments_tenant ON deployments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deployments_environment ON deployments(environment);
CREATE INDEX IF NOT EXISTS idx_deployments_status ON deployments(status);

-- ============================================
-- Pipeline Related Tables
-- ============================================

CREATE TABLE IF NOT EXISTS pipeline_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255),
    pipeline_id VARCHAR(255),
    type VARCHAR(50) NOT NULL,
    config JSONB DEFAULT '{}',
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pipeline_webhook_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255),
    pipeline_id VARCHAR(255),
    webhook_url VARCHAR(1024) NOT NULL,
    secret VARCHAR(512),
    events TEXT[] DEFAULT '{}',
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pipeline_rbac_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255),
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(255),
    action VARCHAR(50) NOT NULL,
    role VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Monitoring & Alert Tables
-- ============================================

CREATE TABLE IF NOT EXISTS alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    condition JSONB NOT NULL,
    severity VARCHAR(20) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_suppression_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    match_conditions JSONB NOT NULL,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    config JSONB NOT NULL,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Secrets & Configuration Tables
-- ============================================

CREATE TABLE IF NOT EXISTS secrets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    value_encrypted TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'generic',
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

CREATE TABLE IF NOT EXISTS configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255),
    key VARCHAR(255) NOT NULL,
    value JSONB NOT NULL,
    type VARCHAR(50) DEFAULT 'application',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, key)
);

-- ============================================
-- Build & Artifact Tables
-- ============================================

CREATE TABLE IF NOT EXISTS artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    version VARCHAR(100),
    location VARCHAR(1024),
    checksum VARCHAR(128),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS build_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255),
    build_id VARCHAR(255),
    job_id VARCHAR(255),
    content TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS build_cache_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    cache_type VARCHAR(50) NOT NULL,
    config JSONB NOT NULL,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS build_cache_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID REFERENCES build_cache_configs(id) ON DELETE CASCADE,
    key VARCHAR(512) NOT NULL,
    value BYTEA,
    size_bytes INTEGER,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- IaC & Infrastructure Tables
-- ============================================

CREATE TABLE IF NOT EXISTS iac_workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    state JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS iac_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES iac_workspaces(id) ON DELETE SET NULL,
    plan_file TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS iac_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    version VARCHAR(100),
    source VARCHAR(1024),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Security & Compliance Tables
-- ============================================

CREATE TABLE IF NOT EXISTS security_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255),
    target_type VARCHAR(50) NOT NULL,
    target_id VARCHAR(255),
    scan_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS security_findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID REFERENCES security_scans(id) ON DELETE CASCADE,
    severity VARCHAR(20) NOT NULL,
    title VARCHAR(512) NOT NULL,
    description TEXT,
    location JSONB,
    remediation TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sbom_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    version VARCHAR(100),
    format VARCHAR(50) NOT NULL,
    content JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sbom_vulnerabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES sbom_documents(id) ON DELETE CASCADE,
    vulnerability_id VARCHAR(255) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    package_name VARCHAR(255),
    fixed_version VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- On-Call Tables
-- ============================================

CREATE TABLE IF NOT EXISTS oncall_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    timezone VARCHAR(50) DEFAULT 'UTC',
    rotation_type VARCHAR(50) DEFAULT 'weekly',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oncall_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID REFERENCES oncall_schedules(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oncall_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID REFERENCES oncall_schedules(id) ON DELETE CASCADE,
    original_user_id VARCHAR(255),
    override_user_id VARCHAR(255) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Quality Gate Tables
-- ============================================

CREATE TABLE IF NOT EXISTS quality_gates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    rules JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quality_gate_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gate_id UUID REFERENCES quality_gates(id) ON DELETE SET NULL,
    pipeline_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    passed BOOLEAN,
    evaluated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Approval Tables
-- ============================================

CREATE TABLE IF NOT EXISTS approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255),
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(255) NOT NULL,
    requested_by VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    approver VARCHAR(255),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    decided_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS inline_script_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255),
    script_content TEXT NOT NULL,
    requester VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    approver VARCHAR(255),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    decided_at TIMESTAMPTZ
);

-- ============================================
-- Rollback & Recovery Tables
-- ============================================

CREATE TABLE IF NOT EXISTS rollback_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255),
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(255) NOT NULL,
    previous_version JSONB,
    rolled_back_by VARCHAR(255),
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Tenant & Quota Tables
-- ============================================

CREATE TABLE IF NOT EXISTS tenant_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    limit_value INTEGER NOT NULL,
    used_value INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, resource_type)
);

-- ============================================
-- Plugin Tables
-- ============================================

CREATE TABLE IF NOT EXISTS plugin_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plugin_id VARCHAR(255) NOT NULL,
    tenant_id VARCHAR(255),
    user_id VARCHAR(255),
    input JSONB DEFAULT '{}',
    output JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'pending',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    config JSONB DEFAULT '{}',
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Event Bus Tables
-- ============================================

CREATE TABLE IF NOT EXISTS event_bus_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    config JSONB NOT NULL,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bus_id UUID REFERENCES event_bus_config(id) ON DELETE CASCADE,
    event_type VARCHAR(255) NOT NULL,
    endpoint VARCHAR(1024) NOT NULL,
    filters JSONB DEFAULT '{}',
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Cron & Schedule Tables
-- ============================================

CREATE TABLE IF NOT EXISTS cron_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    cron_expression VARCHAR(100) NOT NULL,
    command TEXT NOT NULL,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cron_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES cron_jobs(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending',
    output TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Seed Default Commands
-- ============================================

INSERT INTO chatops_commands (name, subcommand, schema, aliases, permission_level, examples)
VALUES
    ('pipeline', 'run', '{"pipelineId": {"type": "string", "required": true}, "params": {"type": "object"}}', ARRAY['pip'], 'user', ARRAY['/pipeline run --pipelineId my-pipeline']),
    ('pipeline', 'status', '{"pipelineId": {"type": "string", "required": true}}', ARRAY['pip stat', 'pip s'], 'user', ARRAY['/pipeline status --pipelineId my-pipeline']),
    ('deploy', 'create', '{"service": {"type": "string", "required": true}, "environment": {"type": "string", "required": true}, "version": {"type": "string"}}', ARRAY['deploy', 'd'], 'user', ARRAY['/deploy create --service my-service --environment prod --version v1.0.0']),
    ('deploy', 'rollback', '{"deployment": {"type": "string", "required": true}, "targetVersion": {"type": "string"}}', ARRAY['rollback', 'rb'], 'admin', ARRAY['/deploy rollback --deployment dep-123']),
    ('restart', 'pod', '{"namespace": {"type": "string", "required": true}, "pod": {"type": "string", "required": true}}', ARRAY['restart', 'rs'], 'admin', ARRAY['/restart pod --namespace default --pod my-pod-abc123']),
    ('logs', 'query', '{"service": {"type": "string"}, "lines": {"type": "number", "default": 100}}', ARRAY['log', 'l'], 'user', ARRAY['/logs query --service my-service --lines 200']),
    ('alert', 'list', '{"severity": {"type": "string"}, "hours": {"type": "number", "default": 24}}', ARRAY['alert', 'al'], 'user', ARRAY['/alert list --severity critical --hours 48']),
    ('diagnose', 'start', '{"target": {"type": "string", "required": true}, "type": {"type": "string", "default": "auto"}}', ARRAY['diag'], 'admin', ARRAY['/diagnose start --target my-service --type auto']),
    ('selfhealing', 'trigger', '{"policy": {"type": "string", "required": true}, "target": {"type": "string"}}', ARRAY['selfhealing', 'heal'], 'admin', ARRAY['/selfhealing trigger --policy auto-restart']),
    ('status', 'system', '{}', ARRAY['stat', 's'], 'user', ARRAY['/status system'])
ON CONFLICT (name) DO NOTHING;