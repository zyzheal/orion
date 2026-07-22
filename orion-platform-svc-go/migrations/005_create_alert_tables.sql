-- Alert module tables

CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    severity VARCHAR(50) NOT NULL DEFAULT 'warning',
    status VARCHAR(50) NOT NULL DEFAULT 'firing',
    fingerprint VARCHAR(255) NOT NULL,
    source_type VARCHAR(100),
    source_id VARCHAR(255),
    source_name VARCHAR(255),
    labels JSONB,
    annotations JSONB,
    value DOUBLE PRECISION DEFAULT 0,
    threshold DOUBLE PRECISION DEFAULT 0,
    metric VARCHAR(255),
    is_duplicate BOOLEAN DEFAULT FALSE,
    group_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_alerts_tenant_id ON alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alerts_group_id ON alerts(group_id);
CREATE INDEX IF NOT EXISTS idx_alerts_fingerprint ON alerts(fingerprint);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);

CREATE TABLE IF NOT EXISTS alert_topologies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    nodes JSONB,
    edges JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_alert_topologies_tenant_id ON alert_topologies(tenant_id);

CREATE TABLE IF NOT EXISTS alert_node_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    node_id VARCHAR(255) NOT NULL,
    node_name VARCHAR(255),
    health VARCHAR(50) NOT NULL DEFAULT 'healthy',
    alert_count INTEGER DEFAULT 0,
    last_update TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE(tenant_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_alert_node_health_tenant_id ON alert_node_health(tenant_id);

CREATE TABLE IF NOT EXISTS alert_maintenance_windows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    scope JSONB,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_maintenance_windows_tenant_id ON alert_maintenance_windows(tenant_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_windows_status ON alert_maintenance_windows(status);

CREATE TABLE IF NOT EXISTS alert_known_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    fingerprint_pattern VARCHAR(255),
    label_selectors JSONB,
    silence_duration BIGINT DEFAULT 3600000,
    status VARCHAR(50) NOT NULL DEFAULT 'open',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_known_issues_tenant_id ON alert_known_issues(tenant_id);
CREATE INDEX IF NOT EXISTS idx_known_issues_status ON alert_known_issues(status);
