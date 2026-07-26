-- Migration 003: Add notification_logs table for send tracking
-- Tracks notification send attempts and results

CREATE TABLE IF NOT EXISTS notification_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id    VARCHAR(255),
  tenant_id     UUID NOT NULL,
  type          VARCHAR(50) NOT NULL,
  subject       VARCHAR(500),
  message       TEXT,
  recipients    JSONB NOT NULL DEFAULT '[]',
  status        VARCHAR(50) NOT NULL DEFAULT 'pending',
  error         TEXT,
  sent_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (channel_id) REFERENCES notification_channels(id) ON DELETE SET NULL
);

CREATE INDEX idx_logs_channel ON notification_logs(channel_id);
CREATE INDEX idx_logs_tenant ON notification_logs(tenant_id);
CREATE INDEX idx_logs_status ON notification_logs(status);
CREATE INDEX idx_logs_created ON notification_logs(created_at DESC);

-- Rollback:
-- DROP TABLE IF EXISTS notification_logs;
