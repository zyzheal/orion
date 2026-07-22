-- Workflow-Task module tables (auto-generated)

CREATE TABLE IF NOT EXISTS workflow_tasks (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    workflow_instance_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(255),
    assignee_id VARCHAR(255),
    status VARCHAR(255) NOT NULL,
    form_data VARCHAR(255),
    comment VARCHAR(255),
    created_by VARCHAR(255) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_workflow_tasks_tenant ON workflow_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_created ON workflow_tasks(created_at DESC);

