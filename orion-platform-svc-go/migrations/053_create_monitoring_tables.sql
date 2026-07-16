-- Monitoring module tables

CREATE TABLE IF NOT EXISTS monitoring_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    unit VARCHAR(50),
    labels JSONB,
    help TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_monitoring_metrics_tenant_id ON monitoring_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_metrics_name ON monitoring_metrics(name);

CREATE TABLE IF NOT EXISTS monitoring_alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    metric VARCHAR(255) NOT NULL,
    operator VARCHAR(10) NOT NULL,
    threshold DOUBLE PRECISION DEFAULT 0,
    evaluation_period INTEGER DEFAULT 60,
    severity VARCHAR(50) NOT NULL DEFAULT 'warning',
    channels JSONB,
    enabled BOOLEAN DEFAULT TRUE,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_monitoring_alert_rules_tenant_id ON monitoring_alert_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_alert_rules_metric ON monitoring_alert_rules(metric);
CREATE INDEX IF NOT EXISTS idx_monitoring_alert_rules_enabled ON monitoring_alert_rules(enabled);

CREATE TABLE IF NOT EXISTS monitoring_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    rule_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'firing',
    message TEXT NOT NULL,
    value DOUBLE PRECISION DEFAULT 0,
    severity VARCHAR(50),
    ack_by VARCHAR(255),
    ack_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_tenant_id ON monitoring_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_rule_id ON monitoring_alerts(rule_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_status ON monitoring_alerts(status);

CREATE TABLE IF NOT EXISTS notification_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    config JSONB NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notification_channels_tenant_id ON notification_channels(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_channels_type ON notification_channels(type);

CREATE TABLE IF NOT EXISTS escalation_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    levels JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_escalation_policies_tenant_id ON escalation_policies(tenant_id);

CREATE TABLE IF NOT EXISTS notification_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    alert_id VARCHAR(255) NOT NULL,
    channel_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notification_records_tenant_id ON notification_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_records_alert_id ON notification_records(alert_id);

CREATE TABLE IF NOT EXISTS widget_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    metric VARCHAR(255),
    config JSONB,
    position INTEGER DEFAULT 0,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_widget_configs_tenant_id ON widget_configs(tenant_id);

CREATE TABLE IF NOT EXISTS monitoring_anomalies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    metric VARCHAR(255) NOT NULL,
    score DOUBLE PRECISION DEFAULT 0,
    baseline DOUBLE PRECISION DEFAULT 0,
    actual DOUBLE PRECISION DEFAULT 0,
    severity VARCHAR(50),
    description TEXT,
    detected_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_monitoring_anomalies_tenant_id ON monitoring_anomalies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_anomalies_metric ON monitoring_anomalies(metric);
