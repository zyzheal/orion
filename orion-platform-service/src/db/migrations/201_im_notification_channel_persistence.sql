-- Migration 201: IM Notification Channel Persistence
-- Stores IM notification channel configurations (DingTalk, WeCom, Feishu)
-- Used by IMNotifier for persistent channel management

CREATE TABLE IF NOT EXISTS im_notification_channels (
  id           VARCHAR(100) PRIMARY KEY,
  tenant_id    VARCHAR(100) NOT NULL DEFAULT 'default',
  platform     VARCHAR(20) NOT NULL CHECK (platform IN ('dingtalk', 'wecom', 'feishu')),
  name         VARCHAR(200) NOT NULL,
  webhook_url  VARCHAR(1000) NOT NULL,
  enabled      BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_im_channels_tenant ON im_notification_channels(tenant_id);
CREATE INDEX IF NOT EXISTS idx_im_channels_platform ON im_notification_channels(platform);
CREATE INDEX IF NOT EXISTS idx_im_channels_enabled ON im_notification_channels(tenant_id, enabled);

COMMENT ON TABLE im_notification_channels IS 'IM notification channel configurations (DingTalk, WeCom, Feishu webhooks)';
COMMENT ON COLUMN im_notification_channels.platform IS 'IM platform type: dingtalk, wecom, feishu';
COMMENT ON COLUMN im_notification_channels.webhook_url IS 'Full webhook URL including access token';

-- Rollback:
-- DROP TABLE IF EXISTS im_notification_channels;
