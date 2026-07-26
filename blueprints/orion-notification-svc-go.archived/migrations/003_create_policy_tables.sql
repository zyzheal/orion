-- Notification policies: rule-based notification triggers
CREATE TABLE IF NOT EXISTS notification_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    description TEXT,
    conditions JSONB NOT NULL DEFAULT '[]',
    channels JSONB NOT NULL DEFAULT '[]',
    recipients JSONB NOT NULL DEFAULT '[]',
    throttle_minutes INTEGER NOT NULL DEFAULT 0,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_by VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_policies_tenant ON notification_policies(tenant_id, enabled);
CREATE INDEX IF NOT EXISTS idx_policies_name ON notification_policies(tenant_id, name);

-- Notification workflows: multi-step escalation/notification flows
CREATE TABLE IF NOT EXISTS notification_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    description TEXT,
    policy_id UUID NOT NULL REFERENCES notification_policies(id) ON DELETE CASCADE,
    steps JSONB NOT NULL DEFAULT '[]',
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_by VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_workflows_policy ON notification_workflows(policy_id);
CREATE INDEX IF NOT EXISTS idx_workflows_tenant ON notification_workflows(tenant_id, enabled);
