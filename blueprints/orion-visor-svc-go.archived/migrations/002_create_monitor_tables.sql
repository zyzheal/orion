-- Monitor hosts: managed hosts for ops visualization
CREATE TABLE IF NOT EXISTS monitor_hosts (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    host VARCHAR(512) NOT NULL,
    port INTEGER NOT NULL DEFAULT 22,
    status VARCHAR(32) NOT NULL DEFAULT 'unknown',
    os_type VARCHAR(64),
    tags JSONB NOT NULL DEFAULT '{}',
    agent_id VARCHAR(128),
    last_heartbeat TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_monitor_hosts_tenant ON monitor_hosts(tenant_id, created_at);
CREATE INDEX idx_monitor_hosts_status ON monitor_hosts(tenant_id, status);

-- Alert rules: configurable alerting rules
CREATE TABLE IF NOT EXISTS alert_rules (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    metric VARCHAR(256) NOT NULL,
    condition VARCHAR(32) NOT NULL,
    threshold DOUBLE PRECISION NOT NULL,
    severity VARCHAR(32) NOT NULL DEFAULT 'warning',
    enabled BOOLEAN NOT NULL DEFAULT true,
    suppressed BOOLEAN NOT NULL DEFAULT false,
    cooldown_ms INTEGER NOT NULL DEFAULT 300000,
    tags JSONB NOT NULL DEFAULT '{}',
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_alert_rules_tenant ON alert_rules(tenant_id, enabled);

-- Alert instances: triggered alert records
CREATE TABLE IF NOT EXISTS alert_instances (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    rule_id UUID NOT NULL,
    rule_name VARCHAR(256),
    metric VARCHAR(256) NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    threshold DOUBLE PRECISION NOT NULL,
    severity VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'triggered',
    message TEXT,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by VARCHAR(128),
    resolved_at TIMESTAMPTZ,
    tags JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_alert_instances_tenant ON alert_instances(tenant_id, status, triggered_at DESC);
CREATE INDEX idx_alert_instances_rule ON alert_instances(rule_id);

-- Metric data points: time-series metric storage
CREATE TABLE IF NOT EXISTS metric_data_points (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    metric_name VARCHAR(256) NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    tags JSONB NOT NULL DEFAULT '{}',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_metric_dp_name_ts ON metric_data_points(metric_name, timestamp DESC);
CREATE INDEX idx_metric_dp_tenant ON metric_data_points(tenant_id, metric_name, timestamp DESC);

-- Notification channels
CREATE TABLE IF NOT EXISTS notification_channels (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    type VARCHAR(32) NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notification_channels_tenant ON notification_channels(tenant_id);

-- Notification history
CREATE TABLE IF NOT EXISTS notification_history (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    alert_id UUID NOT NULL,
    channel_id UUID NOT NULL,
    channel_type VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    error_message TEXT,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notification_history_alert ON notification_history(alert_id);
CREATE INDEX idx_notification_history_tenant ON notification_history(tenant_id, sent_at DESC);
