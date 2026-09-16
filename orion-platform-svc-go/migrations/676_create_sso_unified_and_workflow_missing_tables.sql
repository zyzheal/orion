-- 676_create_sso_unified_and_workflow_missing_tables.sql
-- 3 个模块: sso-unified / workflow-trigger / workflow-webhook。
-- 回滚见 676_create_sso_unified_and_workflow_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS sso_configs (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL,
    provider   TEXT NOT NULL,
    enabled    BOOLEAN NOT NULL DEFAULT TRUE,
    config     JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sso_configs_tenant ON sso_configs(tenant_id);

CREATE TABLE IF NOT EXISTS workflow_trigger_logs (
    id              UUID PRIMARY KEY,
    trigger_id      UUID NOT NULL,
    workflow_id     UUID NOT NULL,
    tenant_id       UUID NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    request_payload JSONB DEFAULT '{}',
    response_body   TEXT NOT NULL DEFAULT '',
    error_message   TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_workflow_trigger_logs_tenant ON workflow_trigger_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflow_trigger_logs_trigger ON workflow_trigger_logs(trigger_id);

CREATE TABLE IF NOT EXISTS workflow_webhook_triggers (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL,
    workflow_id      UUID NOT NULL,
    name             TEXT NOT NULL,
    webhook_path     TEXT NOT NULL,
    webhook_secret   TEXT NOT NULL DEFAULT '',
    trigger_strategy TEXT NOT NULL DEFAULT 'post',
    enabled          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_workflow_webhook_triggers_tenant ON workflow_webhook_triggers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflow_webhook_triggers_workflow ON workflow_webhook_triggers(workflow_id);

CREATE TABLE IF NOT EXISTS workflow_webhook_trigger_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trigger_id      UUID NOT NULL,
    event_type      TEXT NOT NULL DEFAULT '',
    event_payload   JSONB DEFAULT '{}',
    status          TEXT NOT NULL DEFAULT 'pending',
    error_message   TEXT NOT NULL DEFAULT '',
    duration_ms     INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_workflow_webhook_trigger_logs_trigger ON workflow_webhook_trigger_logs(trigger_id);
