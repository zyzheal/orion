-- Migration 048: Create notification_settings table (M8)
-- Per-user notification preferences for M33/M8

CREATE TABLE IF NOT EXISTS notification_settings (
    id          CHAR(36) PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    user_id     VARCHAR(64) NOT NULL,
    tenant_id   VARCHAR(64) NOT NULL,

    -- Channel preferences
    email_enabled   BOOLEAN DEFAULT true,
    sms_enabled     BOOLEAN DEFAULT false,
    webhook_enabled BOOLEAN DEFAULT false,
    webhook_url     TEXT,

    -- Event preferences (which events to notify)
    pipeline_completed  BOOLEAN DEFAULT true,
    pipeline_failed     BOOLEAN DEFAULT true,
    ticket_assigned     BOOLEAN DEFAULT true,
    ticket_escalated    BOOLEAN DEFAULT true,
    sla_warning         BOOLEAN DEFAULT true,
    sla_breached        BOOLEAN DEFAULT true,
    alert_triggered     BOOLEAN DEFAULT true,
    deployment_succeed  BOOLEAN DEFAULT true,
    deployment_failed     BOOLEAN DEFAULT true,
    system_alert        BOOLEAN DEFAULT true,
    comment_mention     BOOLEAN DEFAULT true,
    transfer_request    BOOLEAN DEFAULT true,

    -- Notification style
    digest_enabled      BOOLEAN DEFAULT false,
    digest_frequency    VARCHAR(20) DEFAULT 'daily', -- daily, weekly
    quiet_hours_start   VARCHAR(5), -- HH:MM format
    quiet_hours_end     VARCHAR(5), -- HH:MM format

    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW(),

    UNIQUE (user_id, tenant_id),
    INDEX idx_notification_settings_user (user_id),
    INDEX idx_notification_settings_tenant (tenant_id)
);
