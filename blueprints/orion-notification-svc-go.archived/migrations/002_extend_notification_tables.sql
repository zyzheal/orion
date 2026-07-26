-- Add user_id, type, title, read_at, sent_at to notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_id VARCHAR(64) NOT NULL DEFAULT '';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type VARCHAR(64) NOT NULL DEFAULT 'system';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title VARCHAR(512) NOT NULL DEFAULT '';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, status);

-- Notification settings per user
CREATE TABLE IF NOT EXISTS notification_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(64) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    email_enabled BOOLEAN NOT NULL DEFAULT true,
    slack_enabled BOOLEAN NOT NULL DEFAULT false,
    webhook_enabled BOOLEAN NOT NULL DEFAULT false,
    webhook_url VARCHAR(1024),
    pipeline_completed BOOLEAN NOT NULL DEFAULT true,
    pipeline_failed BOOLEAN NOT NULL DEFAULT true,
    ticket_assigned BOOLEAN NOT NULL DEFAULT true,
    ticket_escalated BOOLEAN NOT NULL DEFAULT true,
    sla_warning BOOLEAN NOT NULL DEFAULT true,
    sla_breached BOOLEAN NOT NULL DEFAULT true,
    alert_triggered BOOLEAN NOT NULL DEFAULT true,
    deployment_success BOOLEAN NOT NULL DEFAULT true,
    deployment_failed BOOLEAN NOT NULL DEFAULT true,
    system_alert BOOLEAN NOT NULL DEFAULT true,
    comment_mention BOOLEAN NOT NULL DEFAULT true,
    transfer_request BOOLEAN NOT NULL DEFAULT true,
    digest_enabled BOOLEAN NOT NULL DEFAULT false,
    digest_frequency VARCHAR(32) NOT NULL DEFAULT 'daily',
    quiet_hours_start VARCHAR(8),
    quiet_hours_end VARCHAR(8),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_settings_user ON notification_settings(user_id, tenant_id);

-- Channel subscriptions per user
CREATE TABLE IF NOT EXISTS notification_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    channel VARCHAR(64) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, user_id, channel)
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON notification_subscriptions(user_id, tenant_id);
