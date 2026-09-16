-- 657_create_webhook_missing_tables.sql
-- webhook 模块: webhooks / webhook_deliveries 2 张表无 CREATE TABLE。
-- 回滚见 657_create_webhook_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS webhooks (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID NOT NULL,
    user_id               UUID,
    name                  TEXT NOT NULL,
    url                   TEXT NOT NULL,
    method                TEXT NOT NULL DEFAULT 'POST',
    event_type            TEXT NOT NULL DEFAULT '',
    secret                TEXT NOT NULL DEFAULT '',
    headers               JSONB DEFAULT '{}',
    body_template         TEXT NOT NULL DEFAULT '',
    enabled               BOOLEAN NOT NULL DEFAULT TRUE,
    max_retries           INTEGER NOT NULL DEFAULT 3,
    retry_interval        INTEGER NOT NULL DEFAULT 60,
    timeout               INTEGER NOT NULL DEFAULT 30,
    last_triggered_at     TIMESTAMPTZ,
    last_delivery_status  TEXT NOT NULL DEFAULT '',
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_webhooks_tenant ON webhooks(tenant_id);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id      UUID NOT NULL,
    url             TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    http_status     INTEGER NOT NULL DEFAULT 0,
    response_body   TEXT NOT NULL DEFAULT '',
    error_message   TEXT NOT NULL DEFAULT '',
    attempt         INTEGER NOT NULL DEFAULT 1,
    retry_after     INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    triggered_at    TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
