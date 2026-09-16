-- 607_create_alert_adapter_v2_missing_tables.sql
-- alert-adapter-v2 模块 3 张表无 CREATE TABLE。
-- 回滚见 607_create_alert_adapter_v2_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS alert_notification_adapters (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL,
    name       TEXT NOT NULL DEFAULT '',
    channel    TEXT NOT NULL DEFAULT '',
    config     JSONB DEFAULT '{}',
    status     TEXT NOT NULL DEFAULT 'active',
    error      TEXT NOT NULL DEFAULT '',
    enabled    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alert_notification_adapters_tenant ON alert_notification_adapters(tenant_id);

CREATE TABLE IF NOT EXISTS alert_notification_templates (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name      TEXT NOT NULL DEFAULT '',
    channel   TEXT NOT NULL DEFAULT '',
    template  TEXT NOT NULL DEFAULT '',
    variables JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alert_notification_templates_tenant ON alert_notification_templates(tenant_id);

CREATE TABLE IF NOT EXISTS alert_notification_events (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    adapter_id    UUID NOT NULL,
    alert_id      TEXT NOT NULL DEFAULT '',
    payload       JSONB DEFAULT '{}',
    status        TEXT NOT NULL DEFAULT 'pending',
    error         TEXT NOT NULL DEFAULT '',
    sent_at       TIMESTAMPTZ,
    delivered_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alert_notification_events_tenant ON alert_notification_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_notification_events_adapter ON alert_notification_events(adapter_id);
