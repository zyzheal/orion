-- Migration 322: Notification Workflows + Policies
-- 通知工作流引擎 + 通知策略

CREATE TABLE IF NOT EXISTS notification_policies (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id       TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    conditions      JSONB NOT NULL DEFAULT '{}',
    channels        JSONB NOT NULL DEFAULT '[]',
    throttle_config JSONB NOT NULL DEFAULT '{}',
    enabled         BOOLEAN NOT NULL DEFAULT true,
    priority        INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_notification_policies_tenant ON notification_policies(tenant_id);

ALTER TABLE notification_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_policies FORCE ROW LEVEL SECURITY;
CREATE POLICY notification_policies_tenant_isolation ON notification_policies
    USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE TABLE IF NOT EXISTS notification_workflows (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id       TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    trigger_type    TEXT NOT NULL,
    trigger_config  JSONB NOT NULL DEFAULT '{}',
    steps           JSONB NOT NULL DEFAULT '[]',
    enabled         BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_notification_workflows_tenant ON notification_workflows(tenant_id);

ALTER TABLE notification_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_workflows FORCE ROW LEVEL SECURITY;
CREATE POLICY notification_workflows_tenant_isolation ON notification_workflows
    USING (tenant_id = current_setting('app.current_tenant_id', true));
