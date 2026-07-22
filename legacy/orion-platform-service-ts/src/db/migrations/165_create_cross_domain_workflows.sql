-- 165_create_cross_domain_workflows.sql
-- Cross-domain workflow definitions and execution records

-- Workflow definitions table
CREATE TABLE IF NOT EXISTS cross_domain_workflows (
    id VARCHAR(255) PRIMARY KEY,
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_by VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_run_at TIMESTAMP
);

-- Workflow steps table
CREATE TABLE IF NOT EXISTS cross_domain_workflow_steps (
    id VARCHAR(255) PRIMARY KEY,
    workflow_id VARCHAR(255) NOT NULL REFERENCES cross_domain_workflows(id) ON DELETE CASCADE,
    domain VARCHAR(32) NOT NULL, -- pipeline, deploy, monitor, security, notify
    action VARCHAR(255) NOT NULL,
    parameters JSONB NOT NULL DEFAULT '{}',
    depends_on JSONB NOT NULL DEFAULT '[]',
    timeout_ms INTEGER NOT NULL DEFAULT 60000,
    retry_policy JSONB,
    step_order INTEGER NOT NULL DEFAULT 0
);

-- Workflow execution records table
CREATE TABLE IF NOT EXISTS cross_domain_executions (
    id VARCHAR(255) PRIMARY KEY,
    workflow_id VARCHAR(255) NOT NULL REFERENCES cross_domain_workflows(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL DEFAULT 'running',
    triggered_by VARCHAR(255) NOT NULL,
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- Workflow execution step results table
CREATE TABLE IF NOT EXISTS cross_domain_execution_steps (
    id VARCHAR(255) PRIMARY KEY,
    execution_id VARCHAR(255) NOT NULL REFERENCES cross_domain_executions(id) ON DELETE CASCADE,
    step_id VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    result JSONB,
    error TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_cdw_tenant ON cross_domain_workflows(tenant_id);
CREATE INDEX idx_cdw_status ON cross_domain_workflows(status);
CREATE INDEX idx_cdws_workflow ON cross_domain_workflow_steps(workflow_id);
CREATE INDEX idx_cdws_domain ON cross_domain_workflow_steps(domain);
CREATE INDEX idx_cde_workflow ON cross_domain_executions(workflow_id);
CREATE INDEX idx_cde_status ON cross_domain_executions(status);
CREATE INDEX idx_cdes_execution ON cross_domain_execution_steps(execution_id);
