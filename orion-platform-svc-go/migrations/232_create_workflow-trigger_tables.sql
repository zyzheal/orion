-- Workflow-Trigger module tables (auto-generated)

CREATE TABLE IF NOT EXISTS workflow_triggers (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    workflow_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(255) NOT NULL,
    config VARCHAR(255) NOT NULL,
    webhook_secret VARCHAR(255) NOT NULL,
    trigger_strategy VARCHAR(255) NOT NULL,
    enabled BOOLEAN NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_workflow_triggers_tenant ON workflow_triggers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflow_triggers_created ON workflow_triggers(created_at DESC);

CREATE TABLE IF NOT EXISTS trigger_logs (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    trigger_id VARCHAR(255) NOT NULL,
    workflow_id VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    request_payload VARCHAR(255) NOT NULL,
    response_body VARCHAR(255) NOT NULL,
    error_message VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_trigger_logs_tenant ON trigger_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_trigger_logs_created ON trigger_logs(created_at DESC);

