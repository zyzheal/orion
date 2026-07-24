-- Low-code Workflow tables
-- Created: 2026-07-13

CREATE TABLE IF NOT EXISTS lowcode_workflow_definition (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    name VARCHAR(255) NOT NULL,
    description TEXT,
    nodes JSONB DEFAULT '[]',
    edges JSONB DEFAULT '[]',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    version VARCHAR(32) NOT NULL DEFAULT '1.0',
    created_by VARCHAR(255) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lowcode_workflow_instance (
    id UUID PRIMARY KEY,
    workflow_id UUID NOT NULL REFERENCES lowcode_workflow_definition(id),
    workflow_definition_id UUID NOT NULL REFERENCES lowcode_workflow_definition(id),
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    input JSONB DEFAULT '{}',
    output JSONB,
    current_node_id VARCHAR(128),
    triggered_by VARCHAR(255) NOT NULL DEFAULT '',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lowcode_workflow_definition_tenant ON lowcode_workflow_definition(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lowcode_workflow_definition_enabled ON lowcode_workflow_definition(enabled);
CREATE INDEX IF NOT EXISTS idx_lowcode_workflow_instance_workflow ON lowcode_workflow_instance(workflow_id);
CREATE INDEX IF NOT EXISTS idx_lowcode_workflow_instance_status ON lowcode_workflow_instance(status);
CREATE INDEX IF NOT EXISTS idx_lowcode_workflow_instance_created ON lowcode_workflow_instance(created_at);