CREATE TABLE IF NOT EXISTS workflow_triggers (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    workflow_id UUID NOT NULL REFERENCES workflows(id),
    name VARCHAR(256) NOT NULL,
    type VARCHAR(32) NOT NULL CHECK (type IN ('event', 'cron', 'manual', 'webhook')),
    config JSONB NOT NULL DEFAULT '{}',
    webhook_secret VARCHAR(256),
    webhook_path VARCHAR(512),
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_by VARCHAR(64) NOT NULL DEFAULT 'system',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_triggers_tenant ON workflow_triggers(tenant_id);
CREATE INDEX idx_triggers_workflow ON workflow_triggers(workflow_id);
CREATE INDEX idx_triggers_type ON workflow_triggers(type);

CREATE TABLE IF NOT EXISTS workflow_trigger_logs (
    id UUID PRIMARY KEY,
    trigger_id UUID NOT NULL REFERENCES workflow_triggers(id),
    event_type VARCHAR(64) NOT NULL DEFAULT 'webhook',
    event_payload JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    error_message TEXT,
    duration_ms INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_trigger_logs_trigger ON workflow_trigger_logs(trigger_id);

CREATE TABLE IF NOT EXISTS workflow_tasks (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    workflow_id UUID NOT NULL REFERENCES workflows(id),
    workflow_instance_id VARCHAR(256) NOT NULL,
    node_id VARCHAR(256) NOT NULL,
    assignee_id VARCHAR(256),
    status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'completed', 'cancelled')),
    comment TEXT,
    form_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tasks_tenant ON workflow_tasks(tenant_id);
CREATE INDEX idx_tasks_assignee ON workflow_tasks(assignee_id);
CREATE INDEX idx_tasks_status ON workflow_tasks(status);
CREATE INDEX idx_tasks_workflow_instance ON workflow_tasks(workflow_instance_id);

CREATE TABLE IF NOT EXISTS workflow_definitions (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    nodes JSONB NOT NULL DEFAULT '[]',
    edges JSONB NOT NULL DEFAULT '[]',
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_by VARCHAR(64) NOT NULL DEFAULT 'system',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_definitions_tenant ON workflow_definitions(tenant_id);

CREATE TABLE IF NOT EXISTS workflow_instances (
    id VARCHAR(256) PRIMARY KEY,
    workflow_id UUID NOT NULL REFERENCES workflow_definitions(id),
    workflow_definition_id UUID NOT NULL REFERENCES workflow_definitions(id),
    tenant_id VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'paused', 'completed', 'failed', 'cancelled')),
    input JSONB NOT NULL DEFAULT '{}',
    output JSONB NOT NULL DEFAULT '{}',
    current_node_id VARCHAR(256),
    triggered_by VARCHAR(64) NOT NULL DEFAULT 'system',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_instances_workflow ON workflow_instances(workflow_id);
CREATE INDEX idx_instances_status ON workflow_instances(status);
