-- 001: Create notification tables
-- Ported from orion-platform-service notification services

-- Notification delivery templates
CREATE TABLE IF NOT EXISTS notify_templates (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    channel VARCHAR(32) NOT NULL,
    recipient VARCHAR(256) NOT NULL,
    subject VARCHAR(512),
    body TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notify_templates_tenant ON notify_templates(tenant_id, created_at);

-- In-app notifications (ported from NotificationRepository.ts)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    type VARCHAR(64) NOT NULL,
    title VARCHAR(512) NOT NULL,
    message TEXT NOT NULL,
    channel VARCHAR(32) NOT NULL DEFAULT 'in-app',
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    sent_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(user_id, status);

-- Per-user notification settings (ported from NotificationSettingsRepository.ts)
CREATE TABLE IF NOT EXISTS notification_settings (
    id UUID PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    sms_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    webhook_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    webhook_url VARCHAR(512),
    pipeline_completed BOOLEAN NOT NULL DEFAULT TRUE,
    pipeline_failed BOOLEAN NOT NULL DEFAULT TRUE,
    ticket_assigned BOOLEAN NOT NULL DEFAULT TRUE,
    ticket_escalated BOOLEAN NOT NULL DEFAULT TRUE,
    sla_warning BOOLEAN NOT NULL DEFAULT TRUE,
    sla_breached BOOLEAN NOT NULL DEFAULT TRUE,
    alert_triggered BOOLEAN NOT NULL DEFAULT TRUE,
    deployment_succeed BOOLEAN NOT NULL DEFAULT TRUE,
    deployment_failed BOOLEAN NOT NULL DEFAULT TRUE,
    system_alert BOOLEAN NOT NULL DEFAULT TRUE,
    comment_mention BOOLEAN NOT NULL DEFAULT TRUE,
    transfer_request BOOLEAN NOT NULL DEFAULT TRUE,
    digest_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    digest_frequency VARCHAR(16) NOT NULL DEFAULT 'daily',
    quiet_hours_start VARCHAR(5),
    quiet_hours_end VARCHAR(5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_notification_settings_user ON notification_settings(user_id, tenant_id);
