-- Migration 399: Workflow schema fix — bridge table names
-- Repository code references: workflow_definitions, workflow_instances, workflow_runs, workflows
-- Migration 080 created: lowcode_workflow_definition, lowcode_workflow_instance (different names!)
-- We CREATE the 4 tables the repository code expects. The legacy lowcode_* tables
-- from 080 remain as-is for backward compatibility.
-- Also adds the 'version' column that WorkflowDefinition model expects.

-- 1. Legacy workflow table (used by handler.go Create/List/Delete/StartRun)
CREATE TABLE IF NOT EXISTS workflows (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    steps JSONB DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_workflows_tenant ON workflows(tenant_id);

-- 2. Workflow run table (used by handler.go StartRun / GetRun)
CREATE TABLE IF NOT EXISTS workflow_runs (
    id VARCHAR(36) PRIMARY KEY,
    workflow_id VARCHAR(36) NOT NULL,
    tenant_id VARCHAR(36) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    input JSONB DEFAULT '{}',
    output JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(tenant_id, status);

-- 3. Workflow definition table (used by handler_extra.go Update/Pause/Resume
--    and Definition service methods)
CREATE TABLE IF NOT EXISTS workflow_definitions (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_tenant ON workflow_definitions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_enabled ON workflow_definitions(tenant_id, enabled);

-- 4. Workflow instance table (used by Definition.Instance service methods)
CREATE TABLE IF NOT EXISTS workflow_instances (
    id VARCHAR(36) PRIMARY KEY,
    workflow_id VARCHAR(36) NOT NULL,
    workflow_definition_id VARCHAR(36) NOT NULL,
    tenant_id VARCHAR(36) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    input JSONB DEFAULT '{}',
    output JSONB DEFAULT '{}',
    current_node_id VARCHAR(128),
    triggered_by VARCHAR(255) NOT NULL DEFAULT '',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_workflow ON workflow_instances(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_status ON workflow_instances(tenant_id, status);