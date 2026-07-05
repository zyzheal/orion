-- Migration: 182_create_tenant_quota_alerts
-- Description: Create tenant quota alerts table for tracking quota threshold violations
-- Created: 2026-05-21

-- Create tenant_quota_alerts table
CREATE TABLE IF NOT EXISTS tenant_quota_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    threshold_percent INTEGER NOT NULL,
    current_usage INTEGER NOT NULL,
    quota_limit INTEGER NOT NULL,
    notify_status VARCHAR(20) DEFAULT 'sent' CHECK (notify_status IN ('pending', 'sent', 'acknowledged', 'resolved')),
    cooldown_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for querying alerts by tenant
CREATE INDEX IF NOT EXISTS idx_tenant_quota_alerts_tenant_id ON tenant_quota_alerts(tenant_id);

-- Index for querying alerts by status
CREATE INDEX IF NOT EXISTS idx_tenant_quota_alerts_status ON tenant_quota_alerts(notify_status);

-- Index for querying recent alerts
CREATE INDEX IF NOT EXISTS idx_tenant_quota_alerts_created_at ON tenant_quota_alerts(created_at DESC);

-- Index for querying active alerts (not in cooldown)
CREATE INDEX IF NOT EXISTS idx_tenant_quota_alerts_cooldown ON tenant_quota_alerts(cooldown_until);

-- Index for querying alerts by resource type
CREATE INDEX IF NOT EXISTS idx_tenant_quota_alerts_resource_type ON tenant_quota_alerts(resource_type);

-- Comments for documentation
COMMENT ON TABLE tenant_quota_alerts IS 'Tracks quota threshold violation alerts for each tenant';
COMMENT ON COLUMN tenant_quota_alerts.tenant_id IS 'UUID of the tenant that owns this alert';
COMMENT ON COLUMN tenant_quota_alerts.resource_type IS 'Type of resource (pipelines, runs, storage, namespaces, etc.)';
COMMENT ON COLUMN tenant_quota_alerts.threshold_percent IS 'The threshold percentage that triggered the alert';
COMMENT ON COLUMN tenant_quota_alerts.current_usage IS 'Current usage of the resource';
COMMENT ON COLUMN tenant_quota_alerts.quota_limit IS 'The quota limit for this resource';
COMMENT ON COLUMN tenant_quota_alerts.notify_status IS 'Status of the notification (pending, sent, acknowledged, resolved)';
COMMENT ON COLUMN tenant_quota_alerts.cooldown_until IS 'Timestamp until which alerts are suppressed';