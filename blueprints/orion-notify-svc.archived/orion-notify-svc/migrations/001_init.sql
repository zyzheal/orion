-- Migration 001: Initialize orion-notify-svc database schema
-- Notification, Notification Settings, and Webhook tables

-- =============================================================================
-- Notifications table
-- =============================================================================
CREATE TABLE IF NOT EXISTS notifications (
    id              CHAR(36) PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    tenant_id       VARCHAR(64) NOT NULL,
    user_id         VARCHAR(64) NOT NULL,
    type            VARCHAR(100) NOT NULL,
    title           VARCHAR(500) NOT NULL,
    message         TEXT NOT NULL,
    channel         VARCHAR(50) NOT NULL DEFAULT 'in-app',
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    sent_at         TIMESTAMP,
    read_at         TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW(),

    INDEX idx_notifications_user (user_id),
    INDEX idx_notifications_tenant (tenant_id),
    INDEX idx_notifications_status (status),
    INDEX idx_notifications_created (created_at)
);

-- =============================================================================
-- Notification Settings table
-- Per-user notification preferences
-- =============================================================================
CREATE TABLE IF NOT EXISTS notification_settings (
    id                  CHAR(36) PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    user_id             VARCHAR(64) NOT NULL,
    tenant_id           VARCHAR(64) NOT NULL,

    -- Channel preferences
    email_enabled       BOOLEAN DEFAULT true,
    sms_enabled         BOOLEAN DEFAULT false,
    webhook_enabled     BOOLEAN DEFAULT false,
    webhook_url         TEXT,

    -- Event preferences
    pipeline_completed  BOOLEAN DEFAULT true,
    pipeline_failed     BOOLEAN DEFAULT true,
    ticket_assigned     BOOLEAN DEFAULT true,
    ticket_escalated    BOOLEAN DEFAULT true,
    sla_warning         BOOLEAN DEFAULT true,
    sla_breached        BOOLEAN DEFAULT true,
    alert_triggered     BOOLEAN DEFAULT true,
    deployment_succeed  BOOLEAN DEFAULT true,
    deployment_failed   BOOLEAN DEFAULT true,
    system_alert        BOOLEAN DEFAULT true,
    comment_mention     BOOLEAN DEFAULT true,
    transfer_request    BOOLEAN DEFAULT true,

    -- Notification style
    digest_enabled      BOOLEAN DEFAULT false,
    digest_frequency    VARCHAR(20) DEFAULT 'daily',
    quiet_hours_start   VARCHAR(5),
    quiet_hours_end     VARCHAR(5),

    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW(),

    UNIQUE (user_id, tenant_id),
    INDEX idx_notification_settings_user (user_id),
    INDEX idx_notification_settings_tenant (tenant_id)
);

-- =============================================================================
-- Webhooks table
-- Custom webhook configurations for event notifications
-- =============================================================================
CREATE TABLE IF NOT EXISTS webhooks (
    id          CHAR(36) PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    tenant_id   VARCHAR(64) NOT NULL,
    name        VARCHAR(200) NOT NULL,
    url         TEXT NOT NULL,
    events      JSONB NOT NULL DEFAULT '[]',
    secret      TEXT,
    active      BOOLEAN DEFAULT true,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW(),

    INDEX idx_webhooks_tenant (tenant_id),
    INDEX idx_webhooks_active (active)
);

-- =============================================================================
-- Webhook Deliveries table
-- Track webhook delivery attempts and results
-- =============================================================================
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id              CHAR(36) PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    webhook_id      VARCHAR(36) NOT NULL,
    event_type      VARCHAR(100) NOT NULL,
    payload         JSONB NOT NULL DEFAULT '{}',
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    response_code   INTEGER,
    response_body   TEXT,
    attempt         INTEGER DEFAULT 1,
    next_retry_at   TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),

    INDEX idx_webhook_deliveries_webhook (webhook_id),
    INDEX idx_webhook_deliveries_status (status),
    INDEX idx_webhook_deliveries_created (created_at),

    CONSTRAINT fk_webhook_deliveries_webhook
        FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
);

-- Rollback:
-- DROP TABLE IF EXISTS webhook_deliveries, webhooks, notification_settings, notifications;