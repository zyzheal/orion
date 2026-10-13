-- Migration 771: Platform Notifications — 通知中心
CREATE TABLE IF NOT EXISTS platform_notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT NOT NULL,
    user_id         TEXT NOT NULL,
    title           TEXT NOT NULL,
    body            TEXT,
    notification_type TEXT NOT NULL DEFAULT 'info',
    -- info, warning, error, success, alert
    channel         TEXT NOT NULL DEFAULT 'in_app',
    -- in_app, email, sms, webhook
    read            BOOLEAN NOT NULL DEFAULT FALSE,
    read_at         TIMESTAMPTZ,
    link_url        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_platform_notifications_user ON platform_notifications(tenant_id, user_id, read, created_at DESC);
