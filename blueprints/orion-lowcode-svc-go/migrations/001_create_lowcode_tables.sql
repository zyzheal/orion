-- ============================================================
-- LowCode Service Schema
-- Ported from orion-platform-service/src/services/lowcode/
-- ============================================================

-- LowCode Apps (component library)
CREATE TABLE IF NOT EXISTS lowcode_apps (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    component_type VARCHAR(64) NOT NULL,
    schema JSONB NOT NULL DEFAULT '{}',
    preview_url TEXT,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lowcode_apps_tenant ON lowcode_apps(tenant_id, created_at);

-- Workflow Definitions
CREATE TABLE IF NOT EXISTS lowcode_workflow_definition (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    description TEXT,
    version INT NOT NULL DEFAULT 1,
    enabled BOOLEAN NOT NULL DEFAULT true,
    nodes JSONB NOT NULL DEFAULT '[]',
    edges JSONB NOT NULL DEFAULT '[]',
    created_by VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lwd_tenant ON lowcode_workflow_definition(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lwd_enabled ON lowcode_workflow_definition(enabled);

-- Workflow Instances
CREATE TABLE IF NOT EXISTS lowcode_workflow_instance (
    id UUID PRIMARY KEY,
    workflow_id UUID NOT NULL,
    workflow_definition_id UUID NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    current_node_id VARCHAR(128) NOT NULL,
    variables JSONB NOT NULL DEFAULT '{}',
    history JSONB NOT NULL DEFAULT '[]',
    input JSONB NOT NULL DEFAULT '{}',
    output JSONB,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_lwi_workflow ON lowcode_workflow_instance(workflow_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lwi_status ON lowcode_workflow_instance(status);
CREATE INDEX IF NOT EXISTS idx_lwi_tenant ON lowcode_workflow_instance(tenant_id);

-- Workflow Timers (delay / timer nodes)
CREATE TABLE IF NOT EXISTS workflow_timers (
    id UUID PRIMARY KEY,
    instance_id UUID NOT NULL,
    node_id VARCHAR(128) NOT NULL,
    timer_type VARCHAR(32) NOT NULL,          -- 'delay' or 'timer'
    duration_ms BIGINT,
    cron_expression VARCHAR(128),
    timezone VARCHAR(64) DEFAULT 'UTC',
    max_executions INT,
    execution_count INT NOT NULL DEFAULT 0,
    scheduled_at TIMESTAMPTZ NOT NULL,
    last_executed_at TIMESTAMPTZ,
    resume_event VARCHAR(256),
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    output_variables JSONB,
    result JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wt_instance ON workflow_timers(instance_id);
CREATE INDEX IF NOT EXISTS idx_wt_status_scheduled ON workflow_timers(status, scheduled_at);

-- Workflow Tasks (manual / system tasks)
CREATE TABLE IF NOT EXISTS workflow_tasks (
    id UUID PRIMARY KEY,
    instance_id UUID NOT NULL,
    node_id VARCHAR(128) NOT NULL,
    task_type VARCHAR(32) NOT NULL DEFAULT 'manual',
    assignee_type VARCHAR(32) NOT NULL DEFAULT 'user',
    assignee_id VARCHAR(128),
    candidate_users JSONB,
    candidate_roles JSONB,
    title VARCHAR(512),
    description TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    priority VARCHAR(32) NOT NULL DEFAULT 'normal',
    due_date TIMESTAMPTZ,
    completed_by VARCHAR(128),
    completed_at TIMESTAMPTZ,
    comment TEXT,
    result JSONB,
    form_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wtk_instance ON workflow_tasks(instance_id);
CREATE INDEX IF NOT EXISTS idx_wtk_status ON workflow_tasks(status);
CREATE INDEX IF NOT EXISTS idx_wtk_assignee ON workflow_tasks(assignee_id);

-- Workflow Triggers (event / cron)
CREATE TABLE IF NOT EXISTS workflow_triggers (
    id UUID PRIMARY KEY,
    workflow_id UUID NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    type VARCHAR(32) NOT NULL,                -- 'event' or 'cron'
    enabled BOOLEAN NOT NULL DEFAULT true,
    event_type VARCHAR(256),
    event_filter JSONB,
    cron_expression VARCHAR(128),
    timezone VARCHAR(64),
    concurrency_limit INT DEFAULT 1,
    created_by VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wtr_workflow ON workflow_triggers(workflow_id);
CREATE INDEX IF NOT EXISTS idx_wtr_type ON workflow_triggers(type);
CREATE INDEX IF NOT EXISTS idx_wtr_enabled ON workflow_triggers(enabled);

-- Sub-workflow Dependencies (parent-child instance tracking for cycle detection)
CREATE TABLE IF NOT EXISTS workflow_sub_workflow_dependencies (
    id UUID PRIMARY KEY,
    parent_instance_id UUID NOT NULL,
    child_instance_id UUID NOT NULL,
    node_id VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wswd_parent ON workflow_sub_workflow_dependencies(parent_instance_id);
CREATE INDEX IF NOT EXISTS idx_wswd_child ON workflow_sub_workflow_dependencies(child_instance_id);
