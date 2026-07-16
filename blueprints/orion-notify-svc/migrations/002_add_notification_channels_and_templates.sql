-- Migration 002: Add notification_channels and notification_templates tables
-- Extended notification management capabilities

-- =============================================================================
-- Notification Channels table
-- Configurable notification delivery channels per tenant
-- =============================================================================
CREATE TABLE IF NOT EXISTS notification_channels (
    id              CHAR(36) PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    tenant_id       VARCHAR(64) NOT NULL,
    name            VARCHAR(100) NOT NULL,
    type            VARCHAR(50) NOT NULL,
    config          JSONB NOT NULL DEFAULT '{}',
    enabled         BOOLEAN DEFAULT true,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),

    INDEX idx_notification_channels_tenant (tenant_id),
    INDEX idx_notification_channels_type (type)
);

-- =============================================================================
-- Notification Templates table
-- Reusable notification templates with variable substitution
-- =============================================================================
CREATE TABLE IF NOT EXISTS notification_templates (
    id              CHAR(36) PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    tenant_id       VARCHAR(64) NOT NULL,
    name            VARCHAR(100) NOT NULL,
    type            VARCHAR(50) NOT NULL,
    subject         VARCHAR(255),
    body            TEXT NOT NULL,
    variables       JSONB,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),

    INDEX idx_notification_templates_tenant (tenant_id),
    INDEX idx_notification_templates_type (type)
);

-- Rollback:
-- DROP TABLE IF EXISTS notification_templates, notification_channels;