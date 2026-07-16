-- Migration 321: Channel Configs + Messages (多渠道入口)
-- 多渠道消息接入配置

CREATE TABLE IF NOT EXISTS channel_configs (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id       TEXT NOT NULL,
    channel_type    TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    config          JSONB NOT NULL DEFAULT '{}',
    enabled         BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_channel_configs_tenant ON channel_configs(tenant_id);
CREATE INDEX idx_channel_configs_type ON channel_configs(channel_type);

ALTER TABLE channel_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_configs FORCE ROW LEVEL SECURITY;
CREATE POLICY channel_configs_tenant_isolation ON channel_configs
    USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE TABLE IF NOT EXISTS channel_messages (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id       TEXT NOT NULL,
    channel_id      TEXT NOT NULL REFERENCES channel_configs(id) ON DELETE CASCADE,
    direction       TEXT NOT NULL DEFAULT 'inbound',
    message_type    TEXT,
    from_address    TEXT,
    to_address      TEXT,
    subject         TEXT,
    body            TEXT,
    metadata        JSONB,
    ticket_id       TEXT,
    status          TEXT NOT NULL DEFAULT 'received',
    error_message   TEXT,
    received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at    TIMESTAMPTZ
);

CREATE INDEX idx_channel_messages_tenant ON channel_messages(tenant_id);
CREATE INDEX idx_channel_messages_channel ON channel_messages(channel_id, received_at DESC);
CREATE INDEX idx_channel_messages_status ON channel_messages(status);

ALTER TABLE channel_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_messages FORCE ROW LEVEL SECURITY;
CREATE POLICY channel_messages_tenant_isolation ON channel_messages
    USING (tenant_id = current_setting('app.current_tenant_id', true));
