-- Migration 060: Omnichannel Ingress (Migration 321)
-- Multi-channel message ingress: email, wechat, dingtalk, slack, webhook, feishu

CREATE TABLE IF NOT EXISTS channel_configs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           VARCHAR(64) NOT NULL,
  name                VARCHAR(255) NOT NULL,
  channel_type        VARCHAR(32) NOT NULL,       -- email|wechat|dingtalk|slack|webhook|feishu
  enabled             BOOLEAN NOT NULL DEFAULT true,
  config              JSONB NOT NULL DEFAULT '{}', -- channel-specific configuration
  webhook_secret      VARCHAR(128),               -- webhook signature secret
  auto_create_ticket  BOOLEAN NOT NULL DEFAULT true,
  default_assignee    VARCHAR(64),
  default_priority    VARCHAR(16) NOT NULL DEFAULT 'medium',
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 60,
  created_by          VARCHAR(64),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS multi-tenant isolation
ALTER TABLE channel_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_configs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON channel_configs USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX idx_channel_configs_tenant ON channel_configs(tenant_id);
CREATE INDEX idx_channel_configs_type ON channel_configs(channel_type);
CREATE INDEX idx_channel_configs_enabled ON channel_configs(enabled) WHERE enabled = true;

-- Channel message log
CREATE TABLE IF NOT EXISTS channel_messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         VARCHAR(64) NOT NULL,
  channel_id        UUID NOT NULL REFERENCES channel_configs(id) ON DELETE CASCADE,
  direction         VARCHAR(16) NOT NULL,          -- inbound|outbound
  message_type      VARCHAR(32),                   -- text|image|file|card
  from_address      VARCHAR(500),
  to_address        VARCHAR(500),
  subject           VARCHAR(500),
  body              TEXT,
  metadata          JSONB,                         -- raw message / attachments / references
  ticket_id         VARCHAR(64),                   -- associated ticket ID
  status            VARCHAR(32) NOT NULL DEFAULT 'received',  -- received|processed|failed|ignored
  error_message     TEXT,
  received_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at      TIMESTAMPTZ
);

-- RLS multi-tenant isolation
ALTER TABLE channel_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_messages FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON channel_messages USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX idx_channel_messages_channel ON channel_messages(channel_id, received_at DESC);
CREATE INDEX idx_channel_messages_ticket ON channel_messages(ticket_id);
CREATE INDEX idx_channel_messages_tenant ON channel_messages(tenant_id);
CREATE INDEX idx_channel_messages_status ON channel_messages(status);
