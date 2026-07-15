-- Workflow-Webhook module tables (auto-generated)

CREATE TABLE IF NOT EXISTS webhook_triggers (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    workflow_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    webhook_path VARCHAR(255) NOT NULL,
    webhook_secret VARCHAR(255) NOT NULL,
    trigger_strategy VARCHAR(255) NOT NULL,
    enabled BOOLEAN NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_webhook_triggers_tenant ON webhook_triggers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_triggers_created ON webhook_triggers(created_at DESC);

